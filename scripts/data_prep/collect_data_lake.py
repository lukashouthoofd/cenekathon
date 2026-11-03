"""Collect the CenEkathon 'open data lake' sources into tidy CSVs.

Output: data/lake/<category>/<source>.csv + data/metadata/lake_sources.csv
Raw downloads are cached in data/lake/raw/ (delete a file to re-fetch).
Sources already collected by scripts/collect_external_data.py (data/external/) are
recorded as skipped with a pointer, not re-downloaded.

Usage: py -I scripts/collect_data_lake.py [--only name1,name2] [--gleif-top 300]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import re
import sys
import time
import traceback
import unicodedata
import zipfile
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
LAKE = ROOT / "data" / "lake"
RAW = LAKE / "raw"
META = ROOT / "data" / "metadata" / "lake_sources.csv"
UA = {"User-Agent": "Mozilla/5.0 (compatible; CenEkathon-2026-research/0.1; hackathon open-data collection)"}
TIMEOUT = 120
NOW = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
TARGET_CC = ["GB", "NL", "BE", "LU"]

SESSION = requests.Session()
SESSION.headers.update(UA)
RESULTS: list[dict] = []


def log(*a):
    print(f"[{datetime.now():%H:%M:%S}]", *a, flush=True)


def fetch(rel: str, url: str, params: dict | None = None, retries: int = 3, sleep: float = 0.0) -> Path:
    """Download url to RAW/rel unless cached. Returns path."""
    p = RAW / rel
    if p.exists() and p.stat().st_size > 0:
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for i in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=TIMEOUT)
            if r.status_code == 429:
                time.sleep(10 * (i + 1)); continue
            r.raise_for_status()
            tmp = p.with_suffix(p.suffix + ".part")
            tmp.write_bytes(r.content)
            tmp.replace(p)
            if sleep: time.sleep(sleep)
            return p
        except Exception as e:  # noqa
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def fetch_json(rel: str, url: str, params: dict | None = None, sleep: float = 0.0):
    p = RAW / rel
    if not p.exists():
        r = None
        for i in range(4):
            r = SESSION.get(url, params=params, timeout=TIMEOUT)
            if r.status_code == 429:
                time.sleep(15 * (i + 1)); continue
            break
        r.raise_for_status()
        p.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(p, "wt", encoding="utf-8") as f:
            f.write(r.text)
        if sleep: time.sleep(sleep)
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.loads(f.read())


def snake(c: str) -> str:
    c = unicodedata.normalize("NFKD", str(c)).encode("ascii", "ignore").decode()
    c = re.sub(r"[^0-9a-zA-Z]+", "_", c).strip("_").lower()
    c = re.sub(r"_+", "_", c)
    return c or "col"


def tidy(df: pd.DataFrame, source: str) -> pd.DataFrame:
    df = df.copy()
    cols, seen = [], {}
    for c in df.columns:
        s = snake(c)
        if s in seen:
            seen[s] += 1; s = f"{s}_{seen[s]}"
        else:
            seen[s] = 0
        cols.append(s)
    df.columns = cols
    if "source" in df.columns:
        df = df.rename(columns={"source": "source_original"})
    df["source"] = source
    return df


def write(category: str, name: str, df: pd.DataFrame) -> tuple[str, int]:
    out = LAKE / category / f"{name}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False, encoding="utf-8", quoting=csv.QUOTE_MINIMAL)
    return str(out.relative_to(ROOT)).replace("\\", "/"), len(df)


def record(category, source_name, output_file, source_url, licence, rows, status, notes):
    RESULTS.append(dict(category=category, source_name=source_name, output_file=output_file or "",
                        source_url=source_url, licence=licence, retrieved_at=NOW, rows=rows,
                        status=status, notes=notes))
    log(f"{status:8s} {source_name} rows={rows} {output_file or ''}")


SOURCES = []


def source(name, category, source_name, url, licence):
    def deco(fn):
        SOURCES.append(dict(name=name, category=category, source_name=source_name, url=url, licence=licence, fn=fn))
        return fn
    return deco


def skipped(category, source_name, url, licence, notes):
    SOURCES.append(dict(name=snake(source_name), category=category, source_name=source_name, url=url,
                        licence=licence, fn=None, notes=notes))


# =============================================================== AI USAGE
AEI = "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/"


def _aei_stream_filter(rel_url: str, cache: str) -> Path:
    """Stream a large AEI csv and keep only global + GB/NL/BE/LU country rows."""
    p = RAW / cache
    if p.exists():
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    keep_geo = {"GLOBAL", *TARGET_CC, "GBR", "NLD", "BEL", "LUX"}
    tmp = p.with_suffix(".part")
    n_in = n_out = 0
    with SESSION.get(AEI + rel_url, stream=True, timeout=TIMEOUT) as r, gzip.open(tmp, "wt", encoding="utf-8", newline="") as out:
        r.raise_for_status()
        lines = (l.decode("utf-8") for l in r.iter_lines())
        reader = csv.reader(lines)
        w = csv.writer(out)
        header = next(reader); w.writerow(header)
        gi = header.index("geo_id")
        for row in reader:
            n_in += 1
            if len(row) > gi and row[gi] in keep_geo:
                w.writerow(row); n_out += 1
    tmp.replace(p)
    log(f"  AEI {rel_url}: kept {n_out}/{n_in} rows")
    return p


@source("anthropic_economic_index", "ai_usage", "Anthropic Economic Index (release 2026-06-26, claude.ai + 1P API)",
        "https://huggingface.co/datasets/Anthropic/EconomicIndex", "MIT (per dataset card)")
def s_aei():
    frames = []
    for f, plat in [("release_2026_06_26/data/aei_claude_ai_2026-06-26.csv", "claude_ai"),
                    ("release_2026_06_26/data/aei_1p_api_2026-06-26.csv", "1p_api")]:
        p = _aei_stream_filter(f, f"anthropic/{Path(f).stem}_filtered.csv.gz")
        d = pd.read_csv(p, dtype=str)
        d.insert(0, "platform", plat)
        frames.append(d)
    df = tidy(pd.concat(frames, ignore_index=True), "anthropic_economic_index")
    return [("anthropic_economic_index", df,
             "long format (geo x facet x metric); filtered to geo_id GLOBAL/GB/NL/BE/LU from 219MB+77MB raw files; "
             "category_name=onet rows carry O*NET task/IWA/DWA ids in node_external_id; job_exposure.csv already in data/external")]


@source("anthropic_task_penetration", "ai_usage", "Anthropic Economic Index: task penetration + robot exposure (occupations)",
        "https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts", "MIT (per dataset card)")
def s_aei_tasks():
    tp = pd.read_csv(fetch("anthropic/task_penetration.csv", AEI + "labor_market_impacts/task_penetration.csv"))
    ro = pd.read_csv(fetch("anthropic/robot_exposure_occupations.csv", AEI + "robot_exposure/robot_exposure_occupations.csv"))
    return [("anthropic_task_penetration", tidy(tp, "anthropic_economic_index"), "O*NET task statement text -> penetration (join on task text with O*NET task_statements)"),
            ("anthropic_robot_exposure_occupations", tidy(ro, "anthropic_economic_index"), "O*NET-SOC level robot exposure index")]


@source("openai_signals", "ai_usage", "OpenAI Signals: How People Use ChatGPT public release CSVs + AI job transition framework",
        "https://openai.com/signals/data-download/", "CC BY 4.0 (cite NBER WP 34255)")
def s_openai():
    p = fetch("openai_signals/data-download-csv.zip", "https://cdn.openai.com/signals/data-download-csv.zip")
    z = zipfile.ZipFile(p)
    frames = []
    for n in z.namelist():
        if n.endswith(".csv") and "__MACOSX" not in n:
            d = pd.read_csv(z.open(n), dtype=str)
            d.insert(0, "table", Path(n).stem)
            frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    lead = ["table", "month", "quarter", "country", "state_code", "state_name"]
    df = df[[c for c in lead if c in df.columns] + [c for c in df.columns if c not in lead]]
    p2 = fetch("openai_signals/ai-job-transition-framework-data-download.zip",
               "https://cdn.openai.com/signals/ai-job-transition-framework-data-download.zip")
    z2 = zipfile.ZipFile(p2)
    n2 = [n for n in z2.namelist() if n.endswith(".csv") and "__MACOSX" not in n][0]
    arch = pd.read_csv(z2.open(n2))
    if "estimated_2024_employment" in arch:
        arch["estimated_2024_employment"] = pd.to_numeric(arch["estimated_2024_employment"].astype(str).str.replace(",", ""), errors="coerce")
    return [("openai_signals_chatgpt_usage", tidy(df, "openai_signals"),
             f"{len(frames)} tables stacked (column 'table' = original file); shares of consumer ChatGPT messages Jul 2024-Dec 2025; country = ISO2; iwa_cleaned = O*NET IWA id"),
            ("openai_signals_occupation_archetypes", tidy(arch, "openai_signals"), "AI job transition framework, O*NET-SOC occupation_code")]


@source("microsoft_working_with_ai", "ai_usage", "Microsoft Research: Working with AI (Tomlinson et al. 2025) occupation AI applicability",
        "https://github.com/microsoft/working-with-ai", "see repo LICENSE.txt (MIT/CDLA per repo)")
def s_ms():
    base = "https://raw.githubusercontent.com/microsoft/working-with-ai/main/"
    a = pd.read_csv(fetch("ms_wwai/ai_applicability_scores.csv", base + "ai_applicability_scores.csv"))
    m = pd.read_csv(fetch("ms_wwai/soc_metrics.csv", base + "soc_metrics.csv"))
    lic = fetch("ms_wwai/LICENSE.txt", base + "LICENSE.txt").read_text(encoding="utf-8", errors="ignore")[:80]
    df = a.merge(m.drop(columns=["title"]), on="SOC Code", how="left")
    df = tidy(df, "microsoft_working_with_ai").rename(columns={"soc_code": "soc_2018_code"})
    return [("microsoft_working_with_ai", df, f"SOC 2018 6-digit; ai_applicability_score + soc_metrics joined; licence header: {lic.splitlines()[0] if lic else '?'}")]


skipped("ai_usage", "Ramp AI Index", "https://ramp.com/data/ai-index", "Ramp terms of use",
        "no open CSV/API download found; figures only rendered on web page (not scraped)")


# =============================================================== AI EXPOSURE (already collected elsewhere)
for nm, url in [("ILO GenAI exposure 2025 (ISCO-08)", "https://github.com/pgmyrek/2025_GenAI_scores_ISCO08"),
                ("GPTs are GPTs occupation exposure", "https://github.com/openai/GPTs-are-GPTs"),
                ("Felten AIOE", "https://github.com/AIOE-Data/AIOE"),
                ("Anthropic Economic Index job_exposure", AEI + "labor_market_impacts/job_exposure.csv")]:
    skipped("ai_exposure", nm, url, "see data/metadata/sources.csv",
            "already collected by scripts/collect_external_data.py -> data/external/ai_research_data.csv (not duplicated)")


# =============================================================== JOBS & SKILLS
ONET = "https://www.onetcenter.org/dl_files/database/db_31_0_csv/"
ONET_LIC = "CC BY 4.0 (O*NET 31.0 Database, U.S. DOL/ETA)"


@source("onet", "jobs_skills", "O*NET 31.0 database: occupation data, task statements, skills",
        "https://www.onetcenter.org/database.html", ONET_LIC)
def s_onet():
    out = []
    for f, name, note in [("occupation_data.csv", "onet_occupations", "O*NET-SOC 2019 codes + descriptions"),
                          ("task_statements.csv", "onet_task_statements", "task_id + task text per O*NET-SOC"),
                          ("skills.csv", "onet_skills", "long format: element_id x scale (IM importance / LV level)")]:
        d = pd.read_csv(fetch(f"onet/{f}", ONET + f), dtype=str)
        d = tidy(d, "onet_31_0")
        if "date" in d.columns:
            d["date"] = pd.to_datetime(d["date"], format="%m/%Y", errors="coerce").dt.strftime("%Y-%m")
        out.append((name, d, note))
    return out


@source("isco_soc_crosswalk", "jobs_skills", "BLS ISCO-08 to 2010 SOC crosswalk",
        "https://www.bls.gov/soc/ISCO_SOC_Crosswalk.xls", "US public domain (BLS)")
def s_xwalk():
    p = fetch("bls/ISCO_SOC_Crosswalk.xls", "https://www.bls.gov/soc/ISCO_SOC_Crosswalk.xls")
    x = pd.read_excel(p, sheet_name="ISCO-08 to 2010 SOC", header=None, dtype=str)
    hdr = x.index[x[0].astype(str).str.contains("ISCO-08 Code", na=False)][0]
    d = x.iloc[hdr + 1:].copy()
    d.columns = [str(c).strip() for c in x.iloc[hdr]]
    d = d.dropna(how="all")
    d = tidy(d, "bls_isco_soc_crosswalk")
    d = d.rename(columns={c: "soc_2010_code" for c in d.columns if c.startswith("2010_soc_code")})
    d = d.rename(columns={c: "soc_2010_title" for c in d.columns if c.startswith("2010_soc_title")})
    d = d.rename(columns={"isco_08_code": "isco08_code", "isco_08_title_en": "isco08_title_en"})
    d = d[d["isco08_code"].astype(str).str.fullmatch(r"\d{4}")]
    return [("isco_soc_crosswalk", d, "SOC 2010 (O*NET-SOC 2019 / SOC 2018 need BLS SOC2010->2018 step; most 6-digit codes unchanged); part='*' = partial match")]


@source("techwolf_models", "jobs_skills", "TechWolf models on Hugging Face (JobBERT etc.) - metadata only",
        "https://huggingface.co/TechWolf", "per model card (Apache-2.0 for JobBERT-v2/v3 as listed)")
def s_techwolf():
    j = fetch_json("techwolf/models.json.gz", "https://huggingface.co/api/models", {"author": "TechWolf", "full": "true", "cardData": "true"})
    rows = []
    for m in j:
        cd = m.get("cardData") or {}
        rows.append(dict(model_id=m["id"], url=f"https://huggingface.co/{m['id']}", pipeline_tag=m.get("pipeline_tag"),
                         library_name=m.get("library_name"), licence=cd.get("license"), downloads=m.get("downloads"),
                         likes=m.get("likes"), created_at=(m.get("createdAt") or "")[:10], last_modified=(m.get("lastModified") or "")[:10],
                         tags="|".join(m.get("tags", []))))
    return [("techwolf_models", tidy(pd.DataFrame(rows), "huggingface_api"), "model ids/links only; models NOT downloaded")]


skipped("jobs_skills", "ESCO occupations + skills (EN/NL/FR) + occupation-skill relations", "https://ec.europa.eu/esco/api",
        "European Commission reuse policy",
        "being collected by scripts/collect_external_data.py -> data/external/skills.csv, data/external/occupations.csv (essential/optional skill URIs per occupation, ISCO-08); not duplicated")


# =============================================================== LABOUR MARKET
@source("indeed_job_postings", "labour_market", "Indeed Hiring Lab job postings tracker (aggregate + sector)",
        "https://github.com/hiring-lab/job_postings_tracker", "CC BY 4.0 (Indeed Hiring Lab)")
def s_indeed():
    base = "https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/"
    frames = []
    for cc in ["GB", "NL", "EA", "FR", "DE", "IE", "US"]:
        d = pd.read_csv(fetch(f"indeed/aggregate_job_postings_{cc}.csv", base + f"{cc}/aggregate_job_postings_{cc}.csv"))
        d.insert(0, "table", "aggregate"); frames.append(d)
    for cc in ["GB", "FR", "DE"]:
        d = pd.read_csv(fetch(f"indeed/job_postings_by_sector_{cc}.csv", base + f"{cc}/job_postings_by_sector_{cc}.csv"))
        d = d.rename(columns={"indeed_job_postings_index": "indeed_job_postings_index_SA"})
        d.insert(0, "table", "by_sector"); frames.append(d)
    df = tidy(pd.concat(frames, ignore_index=True), "indeed_hiring_lab")
    df = df.rename(columns={"display_name": "sector"})
    return [("indeed_job_postings", df, "daily index (Feb 2020=100); BE/LU not published; sector files only GB/FR/DE (sector index is SA per README)")]


@source("indeed_ai_tracker", "labour_market", "Indeed Hiring Lab AI tracker (share of postings mentioning AI/GenAI)",
        "https://github.com/hiring-lab/ai-tracker", "CC BY 4.0 (Indeed Hiring Lab)")
def s_indeed_ai():
    d = pd.read_csv(fetch("indeed/AI_posting.csv", "https://raw.githubusercontent.com/hiring-lab/ai-tracker/main/AI_posting.csv"))
    return [("indeed_ai_tracker", tidy(d, "indeed_hiring_lab"), "all countries in file kept; AI_share_postings in %")]


def _cbs_table(tid: str) -> pd.DataFrame:
    base = f"https://opendata.cbs.nl/ODataApi/odata/{tid}/"
    props = fetch_json(f"cbs/{tid}_props.json.gz", base + "DataProperties", {"$format": "json"})["value"]
    data = fetch_json(f"cbs/{tid}_data.json.gz", base + "TypedDataSet", {"$format": "json"})["value"]
    df = pd.DataFrame(data).drop(columns=["ID"], errors="ignore")
    dims = [p for p in props if p.get("Type") in ("Dimension", "TimeDimension", "GeoDimension")]
    for p in dims:
        key = p["Key"]
        lab = fetch_json(f"cbs/{tid}_{key}.json.gz", base + key, {"$format": "json"})["value"]
        df[key] = df[key].astype(str).str.strip()
        df[key + "_label"] = df[key].map({str(v["Key"]).strip(): v["Title"] for v in lab})
    meas = {p["Key"]: p["Title"] + (f" ({p['Unit']})" if p.get("Unit") else "") for p in props if p.get("Type") == "Topic"}
    idv = [c for c in df.columns if c not in meas]
    long = df.melt(id_vars=idv, value_vars=[c for c in meas if c in df.columns], var_name="measure", value_name="value")
    long["measure_label"] = long["measure"].map(meas)
    long.insert(0, "table_id", tid)
    per = long["Perioden"].astype(str)
    q = per.str.extract(r"^(\d{4})KW0(\d)$")
    long["period_start"] = pd.to_datetime(q[0] + "-" + ((q[1].astype(float) - 1) * 3 + 1).astype("Int64").astype(str).str.zfill(2) + "-01", errors="coerce").dt.strftime("%Y-%m-%d")
    long["period_type"] = per.str[4:6].map({"KW": "quarter", "JJ": "year", "MM": "month"})
    return long


@source("cbs_vacancies", "labour_market", "CBS StatLine: vacancies by SBI 2008 (80474ned seasonally adj.; 80567ned vacancy rate)",
        "https://opendata.cbs.nl/ODataApi/odata/80474ned", "CC BY 4.0 (CBS)")
def s_cbs():
    df = pd.concat([_cbs_table("80474ned"), _cbs_table("80567ned")], ignore_index=True)
    df = tidy(df, "cbs_statline")
    return [("cbs_vacancies", df, "NL; SBI K = Financiele dienstverlening; long format, all periods 1997+; period_start ISO for quarters")]


skipped("labour_market", "Statbel job vacancies", "https://statbel.fgov.be/en/open-data", "Statbel open data licence",
        "no machine-readable vacancy-by-sector open data file found; BE vacancies by NACE available via Eurostat jvs_q_nace2 (data/external/labour_market_data.csv)")
skipped("labour_market", "Eurostat (jvs_q_nace2, lfsq_egan2, une_rt_m, isoc_eb_ai)", "https://ec.europa.eu/eurostat", "CC BY 4.0",
        "already collected -> data/external/labour_market_data.csv / ai_research_data.csv")
skipped("labour_market", "ONS vacancies (AP2Y, JP9Z)", "https://www.ons.gov.uk", "OGL v3.0",
        "already collected -> data/external/labour_market_data.csv")


# =============================================================== COMPANIES
@source("ecb_supervised_entities", "companies", "ECB list of supervised entities (SIs + LSIs), cut-off 1 Sep 2026",
        "https://www.bankingsupervision.europa.eu/framework/supervised-banks/html/index.en.html", "ECB reuse policy (free reuse with attribution)")
def s_ecb():
    url = "https://www.bankingsupervision.europa.eu/ecb/pub/pdf/ssm.listofsupervisedentities202610.en.xlsx"
    p = fetch("ecb/ssm.listofsupervisedentities202610.en.xlsx", url)
    countries = {"Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Estonia", "Finland", "France", "Germany", "Greece",
                 "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Portugal", "Slovakia",
                 "Slovenia", "Spain"}
    rows = []
    # SIs
    x = pd.read_excel(p, sheet_name="SIs", header=None, dtype=str)
    group, head, home = None, None, None
    for _, r in x.iterrows():
        num, lei, typ, mfh, name, cty, ground = r.get(1), r.get(2), r.get(7), r.get(8), r.get(11), r.get(17), r.get(19)
        if isinstance(name, str) and not isinstance(lei, str) and name.strip() in countries:
            home = name.strip(); continue
        if not (isinstance(lei, str) and re.fullmatch(r"[A-Z0-9]{18,20}", lei.strip())):
            continue
        if isinstance(num, str) and num.strip().isdigit():
            group, head = int(num), name
        rows.append(dict(list_type="significant", group_no=group, group_head_name=head, lei=lei.strip(), entity_type=typ,
                         mfh_status=mfh, name=name, home_country=home, country_of_establishment=cty, ground_for_significance=ground, nca=None))
    # LSIs
    x = pd.read_excel(p, sheet_name="LSIs", header=None, dtype=str)
    home, nca = None, None
    for _, r in x.iterrows():
        lei, typ, mfh, name = r.get(1), r.get(5), r.get(7), r.get(9)
        if isinstance(name, str) and not isinstance(lei, str):
            if name.strip() in countries: home, nca = name.strip(), None
            else: nca = name.strip()
            continue
        if not (isinstance(lei, str) and re.fullmatch(r"[A-Z0-9]{18,20}", lei.strip())):
            continue
        rows.append(dict(list_type="less_significant", group_no=None, group_head_name=None, lei=lei.strip(), entity_type=typ,
                         mfh_status=mfh, name=name, home_country=home, country_of_establishment=home, ground_for_significance=None, nca=nca))
    df = tidy(pd.DataFrame(rows), "ecb_banking_supervision")
    df["in_target_country"] = df["home_country"].isin(["Belgium", "Netherlands", "Luxembourg"])
    return [("ecb_supervised_entities", df, "all SSM countries; entity_type CI=credit institution, FH/MFH=(mixed) financial holding, B=branch (MFI code instead of LEI may be skipped); GB not in SSM")]


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\b(plc|ltd|limited|nv|n v|sa|s a|bv|b v|ag|se|group|holding|holdings|uk|the|bank|banque|sarl|llp|lp|inc|co)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


@source("gleif_vacancy_companies", "companies", "GLEIF LEI API: candidate LEIs for top vacancy companies",
        "https://api.gleif.org/api/v1/lei-records", "CC0 1.0")
def s_gleif(top: int = 300):
    comp = pd.read_csv(ROOT / "data" / "external" / "companies.csv", dtype=str)
    comp["posting_count"] = pd.to_numeric(comp["posting_count"], errors="coerce")
    comp = comp.sort_values("posting_count", ascending=False).head(top)
    rows, errors = [], 0
    for i, c in enumerate(comp.itertuples()):
        name, cc = c.company_name, (c.main_country if isinstance(c.main_country, str) else "")
        key = re.sub(r"[^a-z0-9]+", "_", f"{name}_{cc}".lower())[:80]
        params = {"filter[fulltext]": name, "page[size]": 10}
        if cc in TARGET_CC: params["filter[entity.legalAddress.country]"] = cc
        try:
            j = fetch_json(f"gleif/search_{key}.json.gz", "https://api.gleif.org/api/v1/lei-records", params, sleep=1.1)
        except Exception as e:  # noqa
            errors += 1; log("  gleif err", name, e); continue
        cands = []
        for rec in j.get("data", []):
            a = rec["attributes"]; e = a["entity"]
            ln = e["legalName"]["name"]
            score = SequenceMatcher(None, _norm(name), _norm(ln)).ratio()
            cands.append((score, rec["id"], ln, e))
        cands.sort(key=lambda t: -t[0])
        if not cands:
            rows.append(dict(company_name=name, company_key=c.company_key, posting_count=c.posting_count, main_country=cc, rank=None,
                             lei=None, legal_name=None, match_score=None, match_status="no_candidates"))
        for rk, (score, lei, ln, e) in enumerate(cands[:3], 1):
            rows.append(dict(company_name=name, company_key=c.company_key, posting_count=c.posting_count, main_country=cc, rank=rk,
                             lei=lei, legal_name=ln, legal_country=e["legalAddress"].get("country"), hq_country=e["headquartersAddress"].get("country"),
                             legal_city=e["legalAddress"].get("city"), entity_status=e.get("status"), legal_form=(e.get("legalForm") or {}).get("id"),
                             category=e.get("category"), match_score=round(score, 3),
                             match_status="likely" if score >= 0.9 else ("possible" if score >= 0.7 else "weak"),
                             gleif_url=f"https://search.gleif.org/#/record/{lei}"))
        if i % 50 == 0: log(f"  GLEIF {i}/{len(comp)}")
    df = tidy(pd.DataFrame(rows), "gleif_api")
    status_note = f"top {top} companies by posting count (from data/external/companies.csv); fulltext search filtered to main_country; up to 3 candidates per name with fuzzy score on normalised names (verify!); {errors} errors"
    return [("gleif_vacancy_companies", df, status_note)]


skipped("companies", "Companies House (UK)", "https://developer.company-information.service.gov.uk", "OGL v3.0",
        "API requires a (free) registered API key; not used without key")
skipped("companies", "KBO / BCE Open Data (BE)", "https://kbopub.economie.fgov.be/kbo-open-data", "KBO open data licence",
        "bulk download requires account login")


# =============================================================== AI PRICES
@source("litellm_model_prices", "ai_prices", "LiteLLM model_prices_and_context_window.json",
        "https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json", "MIT (BerriAI/litellm)")
def s_litellm():
    p = fetch("litellm/model_prices_and_context_window.json",
              "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json")
    j = json.loads(p.read_text(encoding="utf-8"))
    rows = []
    for k, v in j.items():
        if k == "sample_spec" or not isinstance(v, dict): continue
        r = {"model_key": k}
        for kk, vv in v.items():
            r[kk] = "|".join(map(str, vv)) if isinstance(vv, list) else (json.dumps(vv) if isinstance(vv, dict) else vv)
        rows.append(r)
    df = pd.DataFrame(rows)
    keep = [c for c in df.columns if c in ("model_key", "litellm_provider", "mode", "max_tokens", "max_input_tokens", "max_output_tokens",
                                             "deprecation_date", "source", "supports_vision", "supports_function_calling", "supports_reasoning",
                                             "supports_prompt_caching")
            or c.endswith("_cost_per_token") or c.endswith("cost_per_token_above_200k_tokens") or c in ("input_cost_per_token_batches", "output_cost_per_token_batches")]
    df = df[keep]
    for c in ("input_cost_per_token", "output_cost_per_token"):
        if c in df: df[c.replace("_per_token", "_per_1m_tokens_usd")] = pd.to_numeric(df[c], errors="coerce") * 1e6
    df = tidy(df, "litellm")
    return [("litellm_model_prices", df, "USD per token as published (+ per-1M convenience cols); subset of columns (prices, context, capability flags); snapshot of main branch")]


@source("openrouter_models", "ai_prices", "OpenRouter /api/v1/models", "https://openrouter.ai/api/v1/models", "OpenRouter terms (public API)")
def s_openrouter():
    j = fetch_json("openrouter/models.json.gz", "https://openrouter.ai/api/v1/models")
    rows = []
    for m in j["data"]:
        pr = m.get("pricing") or {}; ar = m.get("architecture") or {}; tp = m.get("top_provider") or {}
        rows.append(dict(model_id=m["id"], canonical_slug=m.get("canonical_slug"), name=m.get("name"),
                         created=datetime.fromtimestamp(m["created"], timezone.utc).strftime("%Y-%m-%d") if m.get("created") else None,
                         context_length=m.get("context_length"), modality=ar.get("modality"), tokenizer=ar.get("tokenizer"),
                         price_prompt_usd_per_token=pr.get("prompt"), price_completion_usd_per_token=pr.get("completion"),
                         price_request_usd=pr.get("request"), price_image_usd=pr.get("image"),
                         price_input_cache_read=pr.get("input_cache_read"), price_internal_reasoning=pr.get("internal_reasoning"),
                         max_completion_tokens=tp.get("max_completion_tokens"), is_moderated=tp.get("is_moderated"),
                         supported_parameters="|".join(m.get("supported_parameters") or [])))
    df = pd.DataFrame(rows)
    for c in ("price_prompt_usd_per_token", "price_completion_usd_per_token"):
        df[c.replace("_per_token", "_per_1m_tokens")] = pd.to_numeric(df[c], errors="coerce") * 1e6
    return [("openrouter_models", tidy(df, "openrouter_api"), "snapshot; prices USD per token as strings from API (+ per-1M numeric cols); negative values = variable pricing")]


@source("epoch_notable_models", "ai_prices", "Epoch AI: Notable AI Models", "https://epoch.ai/data/notable_ai_models.csv", "CC BY 4.0 (Epoch AI)")
def s_epoch():
    d = pd.read_csv(fetch("epoch/notable_ai_models.csv", "https://epoch.ai/data/notable_ai_models.csv"), dtype=str, low_memory=False)
    drop = [c for c in d.columns if c in ("Abstract", "Authors")]
    d = tidy(d.drop(columns=drop), "epoch_ai")
    if "publication_date" in d: d["publication_date"] = pd.to_datetime(d["publication_date"], errors="coerce").dt.strftime("%Y-%m-%d")
    return [("epoch_notable_models", d, "Authors/Abstract columns dropped; training compute (FLOP), parameters, cost (2023 USD) per model")]


@source("wildchat_aggregate", "ai_prices", "WildChat-1M (allenai) aggregate column statistics via HF datasets-server",
        "https://huggingface.co/datasets/allenai/WildChat-1M", "ODC-BY")
def s_wildchat():
    j = fetch_json("wildchat/statistics.json.gz", "https://datasets-server.huggingface.co/statistics",
                   {"dataset": "allenai/WildChat-1M", "config": "default", "split": "train"})
    rows = []
    for s in j["statistics"]:
        col, typ, st = s["column_name"], s["column_type"], s["column_statistics"]
        if col in ("conversation_hash", "hashed_ip", "state", "conversation", "openai_moderation", "detoxify_moderation"):
            continue  # identifiers / free text / redundant
        if "frequencies" in st:
            for k, v in st["frequencies"].items():
                rows.append(dict(column=col, stat="frequency", category=k, value=v))
        if "histogram" in st:
            h = st["histogram"]
            for i, v in enumerate(h["hist"]):
                rows.append(dict(column=col, stat="histogram", bin_start=h["bin_edges"][i], bin_end=h["bin_edges"][i + 1], value=v))
        for k in ("min", "max", "mean", "median", "std", "nan_count", "n_unique"):
            if k in st: rows.append(dict(column=col, stat=k, value=st[k]))
    df = tidy(pd.DataFrame(rows), "wildchat_1m_datasets_server")
    df["num_examples"] = j.get("num_examples"); df["partial"] = j.get("partial")
    return [("wildchat_aggregate", df, "aggregate stats only (model, language, country, turn counts); NO token counts in dataset and no conversation text downloaded; statistics computed by HF on a partial sample (partial=True)")]


# =============================================================== MAIN
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--gleif-top", type=int, default=300)
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    for s in SOURCES:
        if only and s["name"] not in only:
            continue
        if s["fn"] is None:
            record(s["category"], s["source_name"], "", s["url"], s["licence"], 0, "skipped", s["notes"]); continue
        log("->", s["name"])
        try:
            outs = s["fn"](args.gleif_top) if s["name"] == "gleif_vacancy_companies" else s["fn"]()
            for name, df, note in outs:
                f, n = write(s["category"], name, df)
                record(s["category"], s["source_name"] + ("" if name == s["name"] else f" [{name}]"), f, s["url"], s["licence"], n,
                       "ok" if n else "failed", note)
        except Exception as e:  # noqa
            traceback.print_exc()
            record(s["category"], s["source_name"], "", s["url"], s["licence"], 0, "failed", f"{type(e).__name__}: {str(e)[:200]}")
    new = pd.DataFrame(RESULTS)
    if only and META.exists():
        old = pd.read_csv(META, dtype=str)
        old = old[~old["source_name"].isin(new["source_name"]) & ~old["output_file"].fillna("").isin(new["output_file"][new["output_file"] != ""])]
        new = pd.concat([old, new.astype(str)], ignore_index=True)
    META.parent.mkdir(parents=True, exist_ok=True)
    new.to_csv(META, index=False, encoding="utf-8")
    log("metadata ->", META)


if __name__ == "__main__":
    main()
