"""Collect external reference data that fills the gaps in the CenEkathon vacancy data.

The vacancies only have title, description, company, date, country and city. This script adds:

  data/external/skills.csv              ESCO skills (EN/NL/FR labels, type, reuse level, hierarchy)
  data/external/occupations.csv         ESCO occupations with ISCO-08 code and essential/optional skill URIs
  data/external/companies.csv           distinct companies in the vacancies, top N enriched with GLEIF
                                        (LEI, legal name, ultimate parent) and a Jev organisation-type label
  data/external/labour_market_data.csv  Eurostat job vacancies / employment / unemployment (BE, NL, LU, EU27)
                                        and ONS UK vacancies
  data/external/ai_research_data.csv    AI exposure per occupation (ILO 2025, Felten AIOE/AIIE, Eloundou
                                        GPTs-are-GPTs, Anthropic Economic Index) and Eurostat AI use by firms
  data/metadata/sources.csv             provenance of every dataset

Raw downloads are cached under data/external/raw/ (gzip for API pages), so reruns are cheap and idempotent.
Use --refresh to download again.

Usage (from the project root):
  py -I scripts/collect_external_data.py                       # default, modest API volumes
  py -I scripts/collect_external_data.py --company-limit 500   # enrich more companies (GLEIF + Jev)
  py -I scripts/collect_external_data.py --company-limit all   # LARGE: every distinct company (opt-in)
  py -I scripts/collect_external_data.py --no-jev --no-gleif   # no per-company API calls
  py -I scripts/collect_external_data.py --only skills,occupations

The TypeSafe (Jev) key is read from the TYPESAFE_API_KEY environment variable or the .env file in the
project root. It is never printed or written anywhere.
"""
from __future__ import annotations

import argparse
import csv
import difflib
import gzip
import hashlib
import io
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "data" / "external"
RAW = EXT / "raw"
META = ROOT / "data" / "metadata"
UA = "CenEkathon2026-data-collector/1.0 (hackathon research; python-requests)"
TIMEOUT = 120

SOURCES_COLUMNS = ["dataset", "output_file", "source_name", "source_url", "provider", "licence",
                   "retrieved_at", "method", "rows", "status", "notes"]
SOURCES: list[dict] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------- HTTP helpers
SESSION = requests.Session()
SESSION.headers["User-Agent"] = UA
_last_call: dict[str, float] = {}


def http(method: str, url: str, *, host_delay: float = 0.5, retries: int = 4, **kw) -> requests.Response:
    """Polite request: per-host delay, timeout, retry with backoff on 429/5xx/network errors."""
    host = requests.utils.urlparse(url).netloc
    kw.setdefault("timeout", TIMEOUT)
    for attempt in range(retries + 1):
        wait = host_delay - (time.time() - _last_call.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last_call[host] = time.time()
        try:
            r = SESSION.request(method, url, **kw)
        except requests.RequestException as e:
            if attempt == retries:
                raise
            log(f"  network error ({type(e).__name__}), retry {attempt + 1}")
            time.sleep(2 ** attempt)
            continue
        if r.status_code in (429, 500, 502, 503, 504, 529) and attempt < retries:
            ra = r.headers.get("retry-after")
            delay = float(ra) if ra and ra.replace(".", "").isdigit() else 2 ** (attempt + 1)
            log(f"  HTTP {r.status_code}, retry in {delay:.0f}s")
            time.sleep(delay)
            continue
        r.raise_for_status()
        return r
    raise RuntimeError("unreachable")


def cached_bytes(rel: str, url: str, refresh: bool, **kw) -> bytes:
    """Download url once into data/external/raw/<rel>; reuse the cached file afterwards."""
    path = RAW / rel
    if path.exists() and not refresh:
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = http("GET", url, **kw).content
    path.write_bytes(data)
    return data


def cached_json(rel: str, url: str, refresh: bool, params: dict | None = None, **kw):
    path = RAW / (rel + ".json.gz")
    if path.exists() and not refresh:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    obj = http("GET", url, params=params, **kw).json()
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump(obj, f)
    return obj


# ---------------------------------------------------------------- output helpers
def write_csv(df: pd.DataFrame, name: str, columns: list[str]) -> int:
    EXT.mkdir(parents=True, exist_ok=True)
    df = df.reindex(columns=columns) if len(df) else pd.DataFrame(columns=columns)
    df.to_csv(EXT / name, index=False, encoding="utf-8", na_rep="", quoting=csv.QUOTE_MINIMAL,
              lineterminator="\n")
    return len(df)


def add_source(dataset, output_file, source_name, source_url, provider, licence, method, rows, status,
               notes="", retrieved_at=None):
    SOURCES.append(dict(dataset=dataset, output_file=output_file, source_name=source_name,
                        source_url=source_url, provider=provider, licence=licence,
                        retrieved_at=retrieved_at or now_iso(), method=method, rows=rows, status=status,
                        notes=notes))


def run_part(fn, *a, **kw) -> pd.DataFrame:
    """Run one collector; on failure record status=failed and return an empty frame (no fabrication)."""
    meta = fn.meta  # type: ignore[attr-defined]
    try:
        df, notes = fn(*a, **kw)
        add_source(**meta, rows=len(df), status="ok" if len(df) else "empty", notes=notes)
        log(f"  {meta['dataset']}: {len(df)} rows")
        return df
    except Exception as e:  # noqa: BLE001
        msg = f"{type(e).__name__}: {str(e)[:300]}"
        add_source(**meta, rows=0, status="failed", notes=msg)
        log(f"  {meta['dataset']}: FAILED {msg}")
        return pd.DataFrame()


def meta(**m):
    def deco(fn):
        fn.meta = m
        return fn
    return deco


def pipe(values) -> str:
    vals = [v for v in values if v]
    return "|".join(dict.fromkeys(vals))


# ================================================================ ESCO
ESCO_API = "https://ec.europa.eu/esco/api/search"
ESCO_LICENCE = "European Commission reuse policy (Decision 2011/833/EU), free reuse with attribution"


ESCO_SKIPPED: dict[str, int] = {}


def _esco_block(kind: str, start: int, size: int, refresh: bool, full: bool = True) -> list:
    """Fetch items [start, start+size). The API's `offset` is a PAGE index, so start % size == 0.
    Some pages return HTTP 500 with full=true; split them (100 -> 20 -> 5 -> 1) and, for a single
    failing item, fall back to full=false (fewer fields)."""
    tag = "" if full else "_basic"
    try:
        page = cached_json(f"esco/{kind}_s{size}_i{start:05d}{tag}", ESCO_API, refresh,
                           params=dict(language="en", type=kind, limit=size, offset=start // size,
                                       full="true" if full else "false"),
                           host_delay=0.5, retries=1)
        return page["_embedded"]["results"]
    except requests.HTTPError:
        if size > 1:
            sub = {100: 20, 20: 5, 5: 1}[size]
            out = []
            for s0 in range(start, start + size, sub):
                out += _esco_block(kind, s0, sub, refresh, full)
            return out
        if full:
            return _esco_block(kind, start, 1, refresh, full=False)
        ESCO_SKIPPED[kind] = ESCO_SKIPPED.get(kind, 0) + 1
        return []


def esco_pages(kind: str, refresh: bool, page_size: int = 100):
    first = cached_json(f"esco/{kind}_s{page_size}_i00000", ESCO_API, refresh,
                        params=dict(language="en", type=kind, limit=page_size, offset=0, full="true"),
                        host_delay=0.5)
    total = int(first["total"])
    yield from first["_embedded"]["results"]
    for start in range(page_size, total, page_size):
        if start // page_size % 10 == 0:
            log(f"  ESCO {kind}: {start}/{total}")
        yield from _esco_block(kind, start, page_size, refresh)


def _lbl(d, lang):
    return (d or {}).get(lang) or ""


def _links(obj, rel):
    return [x.get("uri", "") for x in (obj.get("_links", {}).get(rel) or [])]


def _link_titles(obj, rel):
    return [x.get("title", "") for x in (obj.get("_links", {}).get(rel) or [])]


SKILL_COLUMNS = ["skill_id", "skill_uri", "preferred_label_en", "preferred_label_nl", "preferred_label_fr",
                 "alt_labels_en", "alt_labels_nl", "alt_labels_fr", "description_en", "skill_type",
                 "reuse_level", "broader_uris", "broader_labels", "n_essential_for_occupations",
                 "n_optional_for_occupations", "status", "source", "source_url", "retrieved_at"]


@meta(dataset="esco_skills", output_file="data/external/skills.csv", source_name="ESCO skills (API)",
      source_url=ESCO_API + "?type=skill&full=true", provider="European Commission (ESCO)",
      licence=ESCO_LICENCE, method="api")
def collect_skills(refresh: bool):
    rows, ts = [], now_iso()
    for s in esco_pages("skill", refresh):
        alt = s.get("alternativeLabel") or {}
        rows.append(dict(
            skill_id=s["uri"].rsplit("/", 1)[-1], skill_uri=s["uri"],
            preferred_label_en=_lbl(s.get("preferredLabel"), "en"),
            preferred_label_nl=_lbl(s.get("preferredLabel"), "nl"),
            preferred_label_fr=_lbl(s.get("preferredLabel"), "fr"),
            alt_labels_en=pipe(alt.get("en", [])), alt_labels_nl=pipe(alt.get("nl", [])),
            alt_labels_fr=pipe(alt.get("fr", [])),
            description_en=((s.get("description") or {}).get("en") or {}).get("literal", ""),
            skill_type=pipe(_link_titles(s, "hasSkillType")), reuse_level=pipe(_link_titles(s, "hasReuseLevel")),
            broader_uris=pipe(_links(s, "broaderHierarchyConcept") + _links(s, "broaderSkill")),
            broader_labels=pipe(_link_titles(s, "broaderHierarchyConcept") + _link_titles(s, "broaderSkill")),
            n_essential_for_occupations=len(_links(s, "isEssentialForOccupation")),
            n_optional_for_occupations=len(_links(s, "isOptionalForOccupation")),
            status=s.get("status", ""), source="ESCO", source_url=s["uri"], retrieved_at=ts))
    return pd.DataFrame(rows).drop_duplicates("skill_uri"), f"ESCO search API, latest released version, labels in EN/NL/FR; {ESCO_SKIPPED.get('skill', 0)} items unretrievable (HTTP 500); items from failing pages fetched with full=false lack description/type/links"


OCC_COLUMNS = ["occupation_id", "occupation_uri", "esco_code", "isco08_code", "preferred_label_en",
               "preferred_label_nl", "preferred_label_fr", "alt_labels_en", "alt_labels_nl", "alt_labels_fr",
               "description_en", "broader_uris", "essential_skill_uris", "optional_skill_uris",
               "n_essential_skills", "n_optional_skills", "status", "source", "source_url", "retrieved_at"]


@meta(dataset="esco_occupations", output_file="data/external/occupations.csv",
      source_name="ESCO occupations (API)", source_url=ESCO_API + "?type=occupation&full=true",
      provider="European Commission (ESCO)", licence=ESCO_LICENCE, method="api")
def collect_occupations(refresh: bool):
    rows, ts = [], now_iso()
    for o in esco_pages("occupation", refresh):
        alt = o.get("alternativeLabel") or {}
        code = o.get("code") or ""
        ess, opt = _links(o, "hasEssentialSkill"), _links(o, "hasOptionalSkill")
        rows.append(dict(
            occupation_id=o["uri"].rsplit("/", 1)[-1], occupation_uri=o["uri"], esco_code=code,
            isco08_code=code.split(".")[0] if re.match(r"^\d{4}", code) else "",
            preferred_label_en=_lbl(o.get("preferredLabel"), "en"),
            preferred_label_nl=_lbl(o.get("preferredLabel"), "nl"),
            preferred_label_fr=_lbl(o.get("preferredLabel"), "fr"),
            alt_labels_en=pipe(alt.get("en", [])), alt_labels_nl=pipe(alt.get("nl", [])),
            alt_labels_fr=pipe(alt.get("fr", [])),
            description_en=((o.get("description") or {}).get("en") or {}).get("literal", ""),
            broader_uris=pipe(_links(o, "broaderOccupation") + _links(o, "broaderIscoGroup")),
            essential_skill_uris=pipe(ess), optional_skill_uris=pipe(opt),
            n_essential_skills=len(ess), n_optional_skills=len(opt),
            status=o.get("status", ""), source="ESCO", source_url=o["uri"], retrieved_at=ts))
    return pd.DataFrame(rows).drop_duplicates("occupation_uri"), (f"{ESCO_SKIPPED.get('occupation', 0)} items unretrievable; ESCO search API; isco08_code = first 4 digits of the ESCO code; "
                                "skill URIs join to skills.csv skill_uri")


# ================================================================ Eurostat / ONS (labour market + AI use)
EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/3.0/data/dataflow/ESTAT/{ds}/1.0/*"
EUROSTAT_LICENCE = "CC BY 4.0 (Eurostat reuse policy)"
GEOS = "BE,NL,LU,EU27_2020"
LM_COLUMNS = ["source", "dataset_code", "series_id", "geo", "period", "period_start", "frequency",
              "indicator", "indicator_label", "nace_r2", "size_class", "sex", "age", "seasonal_adjustment",
              "unit", "value", "obs_flag", "source_url", "retrieved_at"]


def eurostat(ds: str, filters: str, refresh: bool) -> tuple[pd.DataFrame, str]:
    url = (EUROSTAT.format(ds=ds) + f"?c[geo]={GEOS}{filters}&c[TIME_PERIOD]=ge:2019"
           "&format=csvdata&formatVersion=2.0&compress=false")
    raw = cached_bytes(f"eurostat/{ds}.csv", url, refresh, host_delay=1.0)
    return pd.read_csv(io.BytesIO(raw), dtype=str, keep_default_na=False), url


def period_start(p: str) -> str:
    p = str(p)
    if m := re.fullmatch(r"(\d{4})-Q([1-4])", p):
        return f"{m[1]}-{(int(m[2]) - 1) * 3 + 1:02d}-01"
    if re.fullmatch(r"\d{4}-\d{2}", p):
        return p + "-01"
    if re.fullmatch(r"\d{4}", p):
        return p + "-01-01"
    return ""


def eurostat_long(df: pd.DataFrame, ds: str, url: str, indicator_col: str) -> pd.DataFrame:
    ts = now_iso()
    g = lambda c: df[c] if c in df else ""  # noqa: E731
    out = pd.DataFrame(dict(
        source="Eurostat", dataset_code=ds, geo=g("geo"), period=g("TIME_PERIOD"),
        frequency=g("freq"), indicator=g(indicator_col), nace_r2=g("nace_r2"),
        size_class=df["sizeclas"] if "sizeclas" in df else g("size_emp"), sex=g("sex"), age=g("age"),
        seasonal_adjustment=g("s_adj"), unit=g("unit"), value=pd.to_numeric(df["OBS_VALUE"], errors="coerce"),
        obs_flag=g("OBS_FLAG"), source_url=url, retrieved_at=ts))
    out["period_start"] = out["period"].map(period_start)
    key_cols = ["dataset_code", "indicator", "nace_r2", "size_class", "sex", "age", "seasonal_adjustment",
                "unit", "geo"]
    out["series_id"] = out[key_cols].astype(str).agg(".".join, axis=1)
    return out


@meta(dataset="eurostat_jvs_q_nace2", output_file="data/external/labour_market_data.csv",
      source_name="Eurostat job vacancy statistics by NACE Rev.2 (quarterly)",
      source_url=EUROSTAT.format(ds="jvs_q_nace2"), provider="Eurostat", licence=EUROSTAT_LICENCE,
      method="api")
def collect_jvs(refresh: bool):
    df, url = eurostat("jvs_q_nace2", "&c[nace_r2]=K,B-S", refresh)
    out = eurostat_long(df, "jvs_q_nace2", url, "indic_em")
    out["indicator_label"] = out["indicator"].map({"JOBVAC": "job vacancies (number)",
                                                   "JOBOCC": "occupied posts (number)",
                                                   "JOBRATE": "job vacancy rate (%)"}).fillna("")
    return out, "BE/NL/LU/EU27, NACE K (finance & insurance) and B-S (industry+services), 2019+"


@meta(dataset="eurostat_lfsq_egan2", output_file="data/external/labour_market_data.csv",
      source_name="Eurostat LFS employment by NACE Rev.2 section (quarterly)",
      source_url=EUROSTAT.format(ds="lfsq_egan2"), provider="Eurostat", licence=EUROSTAT_LICENCE,
      method="api")
def collect_lfs(refresh: bool):
    df, url = eurostat("lfsq_egan2", "&c[nace_r2]=K,TOTAL", refresh)
    df = df[(df.get("sex") == "T") & (df.get("age").isin(["Y15-64", "Y15-74", "Y20-64"]))]
    out = eurostat_long(df, "lfsq_egan2", url, "unit")
    out["indicator"], out["indicator_label"] = "EMP", "employment (thousand persons)"
    return out, "sex=T, age Y15-64/Y15-74/Y20-64, NACE K and TOTAL, 2019+"


@meta(dataset="eurostat_une_rt_m", output_file="data/external/labour_market_data.csv",
      source_name="Eurostat unemployment rate (monthly, SA)", source_url=EUROSTAT.format(ds="une_rt_m"),
      provider="Eurostat", licence=EUROSTAT_LICENCE, method="api")
def collect_une(refresh: bool):
    df, url = eurostat("une_rt_m", "&c[s_adj]=SA&c[age]=TOTAL&c[sex]=T&c[unit]=PC_ACT", refresh)
    out = eurostat_long(df, "une_rt_m", url, "unit")
    out["indicator"], out["indicator_label"] = "UNE_RT", "unemployment rate (% of active population)"
    return out, "seasonally adjusted, all ages, both sexes, 2019+"


ONS_SERIES = {"ap2y": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/ap2y/lms/data",
              "jp9z": "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/jp9z/lms/data"}


@meta(dataset="ons_vacancies_lms", output_file="data/external/labour_market_data.csv",
      source_name="ONS Labour Market Statistics vacancies time series (AP2Y, JP9Z)",
      source_url="https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/ap2y/lms",
      provider="Office for National Statistics (UK)", licence="Open Government Licence v3.0", method="api")
def collect_ons(refresh: bool):
    rows, ts = [], now_iso()
    months = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP",
                                          "OCT", "NOV", "DEC"], 1)}
    for sid, url in ONS_SERIES.items():
        j = cached_json(f"ons/{sid}", url, refresh, host_delay=1.0)
        title = j.get("description", {}).get("title", "")
        for m in j.get("months", []):
            y, mon = m["date"].split()
            if int(y) < 2019:
                continue
            rows.append(dict(source="ONS", dataset_code="LMS", series_id=sid.upper(), geo="GB",
                             period=f"{y}-{months[mon]:02d}", period_start=f"{y}-{months[mon]:02d}-01",
                             frequency="M", indicator=sid.upper(), indicator_label=title,
                             nace_r2="", size_class="", sex="", age="", seasonal_adjustment="SA",
                             unit="thousands", value=pd.to_numeric(m["value"], errors="coerce"),
                             obs_flag="", source_url=url.rsplit("/data", 1)[0], retrieved_at=ts))
    return pd.DataFrame(rows), ("UK only; monthly values are rolling 3-month averages (label e.g. 2026 JUL-SEP "
                                "stored under middle month); AP2Y = total, JP9Z = total services; "
                                "no finance-only UK series collected")


AI_COLUMNS = ["source", "dataset", "classification", "code", "title", "geo", "period", "indicator",
              "indicator_label", "category", "nace_r2", "size_class", "unit", "value", "obs_flag",
              "source_url", "retrieved_at"]


@meta(dataset="eurostat_isoc_eb_ai", output_file="data/external/ai_research_data.csv",
      source_name="Eurostat: use of artificial intelligence in enterprises (isoc_eb_ai)",
      source_url=EUROSTAT.format(ds="isoc_eb_ai"), provider="Eurostat", licence=EUROSTAT_LICENCE,
      method="api")
def collect_isoc_ai(refresh: bool):
    df, url = eurostat("isoc_eb_ai", "", refresh)
    ts = now_iso()
    out = pd.DataFrame(dict(source="Eurostat", dataset="isoc_eb_ai", classification="nace_r2",
                            code=df["nace_r2"], title="", geo=df["geo"], period=df["TIME_PERIOD"],
                            indicator=df["indic_is"], indicator_label="", category="", nace_r2=df["nace_r2"],
                            size_class=df["size_emp"], unit=df["unit"],
                            value=pd.to_numeric(df["OBS_VALUE"], errors="coerce"), obs_flag=df["OBS_FLAG"],
                            source_url=url, retrieved_at=ts))
    return out, ("enterprise AI adoption, BE/NL/LU/EU27, all indicators, 2019+ (codes per Eurostat "
                 "codelist; e.g. E_AI_TANY = uses any AI technology)")


# ================================================================ AI exposure research datasets
ILO_URL = "https://raw.githubusercontent.com/pgmyrek/2025_GenAI_scores_ISCO08/main/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx"


@meta(dataset="ilo_genai_exposure_2025", output_file="data/external/ai_research_data.csv",
      source_name="ILO Working Paper 140: Generative AI and Jobs, refined global index (Gmyrek et al. 2025)",
      source_url=ILO_URL, provider="ILO (authors' GitHub repository pgmyrek/2025_GenAI_scores_ISCO08)",
      licence="CC BY 4.0", method="download")
def collect_ilo(refresh: bool):
    x = pd.read_excel(io.BytesIO(cached_bytes("ilo/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx", ILO_URL,
                                              refresh)))
    occ = x.groupby("ISCO_08", as_index=False).agg(
        title=("Title", "first"), mean_score_2025=("mean_score_2025", "first"), sd_2025=("SD_2025", "first"),
        mean_score_2023=("mean_score_2023", "first"), potential25=("potential25", "first"),
        n_tasks=("taskID", "count"))
    ts, rows = now_iso(), []
    for _, r in occ.iterrows():
        for ind, lab in [("mean_score_2025", "mean GenAI task exposure score 2025 (0-1)"),
                         ("sd_2025", "SD of task scores 2025"), ("mean_score_2023", "mean task score 2023 index"),
                         ("n_tasks", "number of ISCO tasks scored")]:
            rows.append(dict(source="ILO", dataset="ilo_genai_exposure_2025", classification="isco08_4d",
                             code=str(int(r["ISCO_08"])).zfill(4), title=r["title"], geo="global",
                             period="2025", indicator=ind, indicator_label=lab, category=r["potential25"],
                             unit="score" if ind != "n_tasks" else "count", value=r[ind],
                             source_url=ILO_URL, retrieved_at=ts))
    return pd.DataFrame(rows), "aggregated from task level to ISCO-08 4-digit (values as published per occupation)"


AIOE_URL = "https://raw.githubusercontent.com/AIOE-Data/AIOE/main/AIOE_DataAppendix.xlsx"


@meta(dataset="felten_aioe", output_file="data/external/ai_research_data.csv",
      source_name="Felten, Raj & Seamans (2021) AI Occupational/Industry Exposure (AIOE, AIIE)",
      source_url=AIOE_URL, provider="AIOE-Data GitHub repository (Felten, Raj, Seamans)",
      licence="no licence file in repository; published academic data appendix, cite Felten et al. 2021 (SMJ)",
      method="download")
def collect_aioe(refresh: bool):
    x = pd.read_excel(io.BytesIO(cached_bytes("aioe/AIOE_DataAppendix.xlsx", AIOE_URL, refresh)),
                      sheet_name=None)
    ts, parts = now_iso(), []
    a, b = x["Appendix A"], x["Appendix B"]
    parts.append(pd.DataFrame(dict(source="Felten et al.", dataset="felten_aioe", classification="soc2010",
                                   code=a["SOC Code"].astype(str), title=a["Occupation Title"], geo="US",
                                   period="2021", indicator="aioe", indicator_label="AI occupational exposure (standardised)",
                                   unit="z-score", value=a["AIOE"], source_url=AIOE_URL, retrieved_at=ts)))
    parts.append(pd.DataFrame(dict(source="Felten et al.", dataset="felten_aiie", classification="naics_4d",
                                   code=b["NAICS"].astype(str), title=b["Industry Title"], geo="US",
                                   period="2021", indicator="aiie", indicator_label="AI industry exposure (standardised)",
                                   unit="z-score", value=b["AIIE"], source_url=AIOE_URL, retrieved_at=ts)))
    return pd.concat(parts), "Appendix A (SOC occupations) and B (NAICS 4-digit industries, incl. 52xx finance); US-based"


GPT_URL = "https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv"


@meta(dataset="eloundou_gpts_are_gpts", output_file="data/external/ai_research_data.csv",
      source_name="Eloundou et al. (2023/2024) GPTs are GPTs, occupation-level exposure",
      source_url=GPT_URL, provider="OpenAI GitHub repository openai/GPTs-are-GPTs", licence="MIT",
      method="download")
def collect_gpts(refresh: bool):
    d = pd.read_csv(io.BytesIO(cached_bytes("gpts/occ_level.csv", GPT_URL, refresh)))
    ts = now_iso()
    m = d.melt(id_vars=["O*NET-SOC Code", "Title"], var_name="indicator", value_name="value")
    return pd.DataFrame(dict(source="Eloundou et al.", dataset="eloundou_gpts_are_gpts",
                             classification="onet_soc", code=m["O*NET-SOC Code"], title=m["Title"], geo="US",
                             period="2023", indicator=m["indicator"],
                             indicator_label="exposure share of tasks (alpha=E1, beta=E1+0.5E2, gamma=E1+E2; dv=GPT-4 rated, human=human rated)",
                             unit="share", value=m["value"], source_url=GPT_URL, retrieved_at=ts)), "O*NET-SOC level, US"


AEI_URL = "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv"


@meta(dataset="anthropic_economic_index_job_exposure", output_file="data/external/ai_research_data.csv",
      source_name="Anthropic Economic Index: observed exposure per occupation (labor_market_impacts/job_exposure.csv)",
      source_url=AEI_URL, provider="Anthropic (Hugging Face dataset Anthropic/EconomicIndex)", licence="MIT",
      method="download")
def collect_aei(refresh: bool):
    d = pd.read_csv(io.BytesIO(cached_bytes("anthropic/job_exposure.csv", AEI_URL, refresh)))
    ts = now_iso()
    return pd.DataFrame(dict(source="Anthropic Economic Index", dataset="anthropic_job_exposure",
                             classification="soc2018", code=d["occ_code"], title=d["title"], geo="global",
                             period="", indicator="observed_exposure",
                             indicator_label="observed AI (Claude) usage exposure per occupation",
                             unit="share", value=d["observed_exposure"], source_url=AEI_URL, retrieved_at=ts)), \
        "SOC occupation level; see dataset README for method and period"


# ================================================================ companies (vacancies + GLEIF + Jev)
LEGAL_SUFFIX = re.compile(r"\b(n\.?v|b\.?v|s\.?a|sa/nv|nv/sa|plc|ltd|limited|llp|llc|inc|ag|se|gmbh|s\.?a\.?r\.?l|"
                          r"sarl|sca|scrl|cvba|bvba|srl|group|groupe|holding|holdings|uk|the|co|company|"
                          r"corporation|corp)\b\.?")


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[&+]", " and ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def core_name(s: str) -> str:
    return re.sub(r"\s+", " ", LEGAL_SUFFIX.sub(" ", norm_name(s))).strip()


def load_vacancy_companies(src_dir: Path) -> pd.DataFrame:
    import pyarrow.parquet as pq
    files = sorted(src_dir.glob("vacancies_20[0-9][0-9].parquet"))
    if not files:
        raise FileNotFoundError(f"no vacancies_YYYY.parquet in {src_dir}")
    frames = []
    for f in files:
        log(f"  reading company columns from {f.name}")
        frames.append(pq.read_table(f, columns=["company", "country", "date_posted", "title"]).to_pandas())
    v = pd.concat(frames, ignore_index=True)
    v = v[v["company"].notna() & (v["company"].str.strip() != "")]
    v["company_key"] = v["company"].map(norm_name)
    v = v[v["company_key"] != ""]
    g = v.groupby("company_key")
    out = pd.DataFrame(dict(
        company_name=g["company"].agg(lambda s: s.value_counts().index[0]),
        name_variants=g["company"].nunique(), posting_count=g.size(),
        countries=g["country"].agg(lambda s: "|".join(sorted(s.dropna().unique()))),
        main_country=g["country"].agg(lambda s: s.value_counts().index[0] if s.notna().any() else ""),
        first_posted=g["date_posted"].min(), last_posted=g["date_posted"].max(),
        example_titles=g["title"].agg(lambda s: "|".join(s.dropna().value_counts().index[:5])),
    )).reset_index()
    out["company_id"] = out["company_key"].map(lambda k: "cmp_" + hashlib.sha1(k.encode()).hexdigest()[:12])
    for c in ("first_posted", "last_posted"):
        out[c] = pd.to_datetime(out[c]).dt.strftime("%Y-%m-%d")
    return out.sort_values("posting_count", ascending=False).reset_index(drop=True)


GLEIF = "https://api.gleif.org/api/v1"


def _ascii_share(s: str) -> float:
    s = re.sub(r"\s", "", s)
    return sum(c.isascii() for c in s) / max(len(s), 1)


def gleif_match(name: str, country: str, refresh: bool) -> dict:
    """Candidates from GLEIF legal-name search (global) + full-text search in the main country.
    Score = similarity of names after removing legal suffixes (legal name; other names -0.03).
    Funds and non-Latin names are skipped; ties prefer ACTIVE, same country, then shorter names.
    Only matches with score >= 0.9 are kept and they remain *candidates* to verify."""
    cc = country if country in ("GB", "BE", "NL", "LU") else ""
    target = core_name(name)
    if len(target) < 3:
        return {"gleif_match_status": "name_too_short"}
    queries = [{"filter[entity.legalName]": name, "page[size]": 20}]
    if cc:
        queries.append({"filter[fulltext]": name, "filter[entity.legalAddress.country]": cc, "page[size]": 20})
    cands = []
    for params in queries:
        key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
        j = cached_json(f"gleif/search_{key}", f"{GLEIF}/lei-records", refresh, params=params, host_delay=1.1)
        for rec in j.get("data", []):
            e = rec["attributes"]["entity"]
            if e.get("category") == "FUND":
                continue
            names = [(e["legalName"]["name"], 0.0)] + [(n["name"], 0.03) for n in e.get("otherNames") or []]
            sc = max(difflib.SequenceMatcher(None, target, core_name(n)).ratio() - pen
                     for n, pen in names if _ascii_share(n) > 0.9) if any(_ascii_share(n) > 0.9 for n, _ in names) else 0
            ctry = e["legalAddress"].get("country", "")
            tie = (ctry == cc, e.get("status") == "ACTIVE", -len(e["legalName"]["name"]))
            cands.append((round(sc, 3), tie, rec))
    if not cands:
        return {"gleif_match_status": "no_candidates"}
    sc, _, best = max(cands, key=lambda t: (t[0], t[1]))
    if sc < 0.9:
        return {"gleif_match_status": "no_confident_match"}
    e = best["attributes"]["entity"]
    return dict(gleif_lei=best["id"], gleif_legal_name=e["legalName"]["name"],
                gleif_legal_country=e["legalAddress"].get("country", ""),
                gleif_hq_country=(e.get("headquartersAddress") or {}).get("country", ""),
                gleif_entity_status=e.get("status", ""), gleif_legal_form=(e.get("legalForm") or {}).get("id", ""),
                gleif_match_score=sc,
                gleif_match_status="candidate_match" if e["legalAddress"].get("country", "") == cc
                else "candidate_match_other_country",
                gleif_url=f"https://search.gleif.org/#/record/{best['id']}")


def gleif_parent(lei: str, refresh: bool) -> dict:
    try:
        j = cached_json(f"gleif/parent_{lei}", f"{GLEIF}/lei-records/{lei}/ultimate-parent", refresh,
                        host_delay=1.1, retries=2)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return {"gleif_ultimate_parent_lei": "", "gleif_ultimate_parent_name": ""}
        raise
    d = j.get("data") or {}
    if not d:
        return {}
    return dict(gleif_ultimate_parent_lei=d.get("id", ""),
                gleif_ultimate_parent_name=d["attributes"]["entity"]["legalName"]["name"])


def load_typesafe_key() -> str | None:
    key = os.environ.get("TYPESAFE_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("TYPESAFE_API_KEY") and "=" in line:
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    return key or None


JEV_URL = "https://api.typesafe.ai/v1/systemone"
ORG_TYPES = {
    "bank": "Bank or credit institution (retail, commercial, private or investment bank)",
    "insurer": "Insurance or reinsurance company, including pension insurers",
    "asset_manager": "Asset/investment manager, fund, pension fund, wealth manager or broker",
    "payments_fintech": "Payment provider, card scheme, neobank or financial technology company",
    "market_infrastructure_or_data": "Exchange, clearing, rating agency, financial data/information provider",
    "professional_services": "Consulting, audit, accounting, legal or IT services firm",
    "recruitment_agency": "Staffing, recruitment, interim or executive search agency posting for clients",
    "job_board": "Job board or job aggregator website",
    "public_sector": "Central bank, regulator, government or public body",
    "other": "Any other kind of organisation",
}


def jev_classify(row: pd.Series, key: str, refresh: bool) -> dict:
    cache = RAW / "jev" / f"{row['company_id']}.json"
    if cache.exists() and not refresh:
        j = json.loads(cache.read_text(encoding="utf-8"))
    else:
        body = {"model": "jev-latest",
                "state": {"company_name_as_posted": row["company_name"], "main_country": row["main_country"],
                          "posting_count": int(row["posting_count"]),
                          "example_job_titles": row["example_titles"].split("|")[:5]},
                "questions": {
                    "org_type": {"type": "choice",
                                 "instructions": "Which kind of organisation is the company that published these job postings?",
                                 "criteria": ORG_TYPES},
                    "is_financial_company": {"type": "noul",
                                             "instructions": "Is this company itself a financial-services company (bank, insurer, asset manager, payments, financial market infrastructure)?",
                                             "criteria": {"true": "it provides financial services itself",
                                                          "false": "recruiter, job board, consultancy or non-financial firm"}}}}
        r = http("POST", JEV_URL, host_delay=0.2, json=body, timeout=60,
                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        j = r.json()
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(j), encoding="utf-8")
    a = j.get("answers", {})
    return dict(jev_org_type=a.get("org_type", {}).get("choice", ""),
                jev_org_type_confidence=a.get("org_type", {}).get("confidence", ""),
                jev_is_financial_probability=a.get("is_financial_company", {}).get("noul", ""),
                jev_model=j.get("model", ""),
                jev_input_tokens=j.get("usage", {}).get("input_tokens", ""))


COMPANY_COLUMNS = ["company_id", "company_name", "company_key", "name_variants", "posting_count", "countries",
                   "main_country", "first_posted", "last_posted", "gleif_lei", "gleif_legal_name",
                   "gleif_legal_country", "gleif_hq_country", "gleif_entity_status", "gleif_legal_form",
                   "gleif_ultimate_parent_lei", "gleif_ultimate_parent_name", "gleif_match_score",
                   "gleif_match_status", "gleif_url", "jev_org_type", "jev_org_type_confidence",
                   "jev_is_financial_probability", "jev_model", "source", "enrichment_source", "retrieved_at"]


def collect_companies(src_dir: Path, limit: int | None, use_gleif: bool, use_jev: bool, refresh: bool):
    ts = now_iso()
    try:
        comp = load_vacancy_companies(src_dir)
        add_source("vacancy_companies", "data/external/companies.csv",
                   "Distinct company names in CenEkathon vacancies 2021-2026", str(src_dir),
                   "TechWolf / CenEkathon 2026 (hackathon data)", "CenEkathon use only, do not share",
                   "download", len(comp), "ok",
                   "names grouped by normalised key (lowercase, accents/punctuation removed); not deduplicated "
                   "across legal suffixes or brands", ts)
    except Exception as e:  # noqa: BLE001
        add_source("vacancy_companies", "data/external/companies.csv", "Distinct company names in vacancies",
                   str(src_dir), "TechWolf / CenEkathon 2026", "CenEkathon use only", "download", 0, "failed",
                   f"{type(e).__name__}: {e}", ts)
        return pd.DataFrame()
    comp["source"] = "cenekathon_vacancies"
    comp["retrieved_at"] = ts
    for c in COMPANY_COLUMNS:
        if c not in comp:
            comp[c] = pd.Series(pd.NA, index=comp.index, dtype="object")
    n = len(comp) if limit is None else min(limit, len(comp))
    top = comp.index[:n]

    if use_gleif:
        ok = fail = matched = 0
        for i in top:
            try:
                m = gleif_match(comp.at[i, "company_name"], comp.at[i, "main_country"], refresh)
                if m.get("gleif_lei"):
                    m.update(gleif_parent(m["gleif_lei"], refresh))
                    matched += 1
                for k, val in m.items():
                    comp.at[i, k] = val
                ok += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                comp.at[i, "gleif_match_status"] = f"error: {type(e).__name__}"
            if (ok + fail) % 25 == 0:
                log(f"  GLEIF {ok + fail}/{n} (matched {matched})")
        add_source("gleif_company_enrichment", "data/external/companies.csv", "GLEIF LEI records API",
                   f"{GLEIF}/lei-records", "Global Legal Entity Identifier Foundation (GLEIF)", "CC0 1.0", "api",
                   matched, "ok" if ok else "failed",
                   f"top {n} companies by posting count searched; {matched} candidate matches (name similarity "
                   f">=0.9 after removing legal suffixes, funds excluded; verify before relying on them); {fail} errors; "
                   "ultimate parent from /ultimate-parent")
    else:
        add_source("gleif_company_enrichment", "data/external/companies.csv", "GLEIF LEI records API",
                   f"{GLEIF}/lei-records", "GLEIF", "CC0 1.0", "api", 0, "skipped", "--no-gleif")

    key = load_typesafe_key() if use_jev else None
    if use_jev and not key:
        add_source("jev_company_org_type", "data/external/companies.csv", "TypeSafe Jev decision API",
                   JEV_URL, "TypeSafe", "commercial API (hackathon key)", "api", 0, "failed",
                   "TYPESAFE_API_KEY not found")
    elif use_jev:
        ok = fail = tokens = 0
        for i in top:
            try:
                res = jev_classify(comp.loc[i], key, refresh)
                tokens += int(res.pop("jev_input_tokens") or 0)
                for k, val in res.items():
                    comp.at[i, k] = val
                ok += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                log(f"  Jev error for one company: {type(e).__name__} {getattr(getattr(e, 'response', None), 'status_code', '')}")
            if (ok + fail) % 50 == 0:
                log(f"  Jev {ok + fail}/{n}")
        add_source("jev_company_org_type", "data/external/companies.csv", "TypeSafe Jev decision API (jev-latest)",
                   JEV_URL, "TypeSafe", "commercial API (hackathon key)", "api", ok, "ok" if ok else "failed",
                   f"model-generated labels (not ground truth) for top {n} companies: org_type choice over "
                   f"{len(ORG_TYPES)} options + is_financial probability, from name, country and 5 example "
                   f"titles; {fail} errors; ~{tokens} input tokens this run (cached calls count 0)")
    else:
        add_source("jev_company_org_type", "data/external/companies.csv", "TypeSafe Jev decision API",
                   JEV_URL, "TypeSafe", "commercial API", "api", 0, "skipped", "--no-jev")

    enr = []
    for i in comp.index:
        e = []
        if pd.notna(comp.at[i, "gleif_lei"]) if "gleif_lei" in comp else False:
            e.append("gleif")
        if pd.notna(comp.at[i, "jev_org_type"]) if "jev_org_type" in comp else False:
            e.append("typesafe_jev")
        enr.append("|".join(e))
    comp["enrichment_source"] = enr
    return comp


# ================================================================ main
PARTS = ["skills", "occupations", "companies", "labour_market", "ai_research"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src-dir", default=r"C:\Users\boton\Downloads",
                    help="folder with the hackathon vacancies_YYYY.parquet files (company names only are read)")
    ap.add_argument("--only", default=",".join(PARTS), help="comma list of parts: " + ",".join(PARTS))
    ap.add_argument("--company-limit", default="100",
                    help="number of top companies (by postings) to enrich via GLEIF + Jev, or 'all' (LARGE, opt-in)")
    ap.add_argument("--no-gleif", action="store_true")
    ap.add_argument("--no-jev", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="ignore the raw cache and download again")
    args = ap.parse_args()
    parts = {p.strip() for p in args.only.split(",") if p.strip()}
    limit = None if args.company_limit == "all" else int(args.company_limit)
    META.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)

    if "skills" in parts:
        log("ESCO skills")
        write_csv(run_part(collect_skills, args.refresh), "skills.csv", SKILL_COLUMNS)
    if "occupations" in parts:
        log("ESCO occupations")
        write_csv(run_part(collect_occupations, args.refresh), "occupations.csv", OCC_COLUMNS)
    if "labour_market" in parts:
        log("Labour market (Eurostat, ONS)")
        dfs = [run_part(f, args.refresh) for f in (collect_jvs, collect_lfs, collect_une, collect_ons)]
        write_csv(pd.concat([d for d in dfs if len(d)] or [pd.DataFrame()]), "labour_market_data.csv", LM_COLUMNS)
    if "ai_research" in parts:
        log("AI research (ILO, Felten, Eloundou, Anthropic, Eurostat)")
        dfs = [run_part(f, args.refresh) for f in (collect_ilo, collect_aioe, collect_gpts, collect_aei,
                                                   collect_isoc_ai)]
        write_csv(pd.concat([d for d in dfs if len(d)] or [pd.DataFrame()]), "ai_research_data.csv", AI_COLUMNS)
    if "companies" in parts:
        log("Companies (vacancies + GLEIF + Jev)")
        write_csv(collect_companies(Path(args.src_dir), limit, not args.no_gleif, not args.no_jev, args.refresh),
                  "companies.csv", COMPANY_COLUMNS)

    # merge with existing sources.csv so partial (--only) runs keep other rows
    src_path = META / "sources.csv"
    new = pd.DataFrame(SOURCES, columns=SOURCES_COLUMNS)
    if src_path.exists():
        old = pd.read_csv(src_path, dtype=str, keep_default_na=False)
        old = old[~old["dataset"].isin(new["dataset"])]
        new = pd.concat([old, new], ignore_index=True)
    new.to_csv(src_path, index=False, encoding="utf-8", lineterminator="\n")
    log(f"sources.csv: {len(new)} rows")
    failed = new[new["status"] == "failed"]
    if len(failed):
        log("FAILED: " + ", ".join(failed["dataset"]))


if __name__ == "__main__":
    sys.exit(main())
