"""Search API over rag.duckdb (built by build.py) for the Claude agent; tool schemas are in tools.json.

Run from src/rag, bound to localhost only (the posting data is confidential):
  RAG_DB=rag.duckdb uvicorn serve:app --host 127.0.0.1 --port 8000
From a laptop:
  ssh -L 8000:localhost:8000 team19      then  curl localhost:8000/health

Endpoints: POST /search_postings, /similar_titles, /extract_skills, /top_skills, /company_sql; GET /health.
Set COMPANY_DB=path/to/company.duckdb (built by company.py) to enable /company_sql, /company_profile, /skill_gap (SYNTHETIC internal data, read-only).
"""
import os
import re
from typing import Optional

import duckdb
import numpy as np
import torch
from fastapi import FastAPI
from pydantic import BaseModel, Field

import models

def company_pattern(name):
    """Regex matching `name` as whole word(s) of company_norm: "ing" hits "ing bank", not "lloyds banking"."""
    q = " ".join(re.escape(w) for w in name.lower().split())
    return f"(^|[^a-z0-9]){q}([^a-z0-9]|$)"


con = duckdb.connect(os.environ.get("RAG_DB", "rag.duckdb"), read_only=True)
# SYNTHETIC internal company data (Goldman Stanley, data/synthetic via company.py): read-only, and SQL may not touch files.
company = duckdb.connect(os.environ["COMPANY_DB"], read_only=True, config={"enable_external_access": False}) \
    if os.environ.get("COMPANY_DB") else None


def load(sql):
    """Run sql (selects an `emb` FLOAT[d] column) -> (metadata DataFrame, fp16 [n, d] tensor on DEVICE)."""
    t = con.execute(sql).fetch_arrow_table()
    d = t.schema.field("emb").type.list_size
    emb = torch.empty((t.num_rows, d), dtype=torch.float16, device=models.DEVICE)
    i = 0
    for c in t["emb"].chunks:  # per record batch, so the vectors are never copied whole on the host
        emb[i:i + len(c)] = torch.from_numpy(c.flatten().to_numpy().reshape(-1, d))
        i += len(c)
    return t.select([n for n in t.column_names if n != "emb"]).to_pandas(), emb


CH, CH_EMB = load("""
    SELECT c.vacancy_id, c.chunk_idx, p.title, p.company, p.company_norm, p.country, p.city,
           p.first_posted, year(p.first_posted) AS year, c.emb
    FROM chunks c JOIN postings p USING (vacancy_id)""")
for col in ("country", "company_norm"):
    CH[col] = CH[col].astype("category")
TI, TI_EMB = load("SELECT title_norm, n_postings, emb FROM titles")
chunk_enc = models.ChunkEncoder()
title_enc = models.TitleEncoder()
matcher = models.SkillMatcher([s for (s,) in con.execute("SELECT skill FROM skills ORDER BY skill_id").fetchall()])

app = FastAPI(title="Vacancy RAG")


class Filters(BaseModel):
    country: Optional[str] = None       # BE, NL, LU, GB
    company: Optional[str] = None       # whole word(s) of company_norm, case-insensitive
    year_from: Optional[int] = None     # on year(first_posted), inclusive
    year_to: Optional[int] = None


class SearchReq(Filters):
    query: str
    k: int = Field(8, ge=1, le=50)


class TopSkillsReq(Filters):
    title_contains: Optional[str] = None
    k: int = Field(20, ge=1, le=200)


class TitleReq(BaseModel):
    title: str
    k: int = Field(10, ge=1, le=100)


class SkillsReq(BaseModel):
    text: str
    threshold: float = models.SKILL_THRESHOLD


def py(v):
    """numpy scalar -> plain Python (JSON-serialisable)."""
    return v.item() if isinstance(v, np.generic) else v


def to_query(vec):
    return torch.from_numpy(vec).to(models.DEVICE, torch.float16)


@app.post("/search_postings")
def search_postings(r: SearchReq):
    mask = np.ones(len(CH), bool)
    if r.country:
        mask &= (CH.country == r.country.strip().upper()).to_numpy()
    if r.company:
        hit = np.asarray(CH.company_norm.cat.categories.str.contains(company_pattern(r.company), regex=True))
        mask &= hit[CH.company_norm.cat.codes.to_numpy()]
    if r.year_from:
        mask &= CH.year.to_numpy() >= r.year_from
    if r.year_to:
        mask &= CH.year.to_numpy() <= r.year_to
    score = (CH_EMB @ to_query(chunk_enc.encode([r.query])[0])).float()
    score[~torch.from_numpy(mask).to(models.DEVICE)] = -torch.inf
    # Exact top-k; oversample so k distinct postings survive the one-chunk-per-posting rule.
    top = score.topk(min(len(score), r.k * 10))
    hits, seen = [], set()
    for s, i in zip(top.values.tolist(), top.indices.tolist()):
        if s == -float("inf") or len(hits) == r.k:
            break
        row = CH.iloc[i]
        vid = py(row["vacancy_id"])
        if vid in seen:
            continue
        seen.add(vid)
        hits.append({"vacancy_id": vid, "chunk_idx": py(row["chunk_idx"]), "title": row["title"],
                     "company": row["company"], "country": row["country"], "city": row["city"],
                     "first_posted": row["first_posted"], "score": round(s, 4)})
    if not hits:
        return []
    with con.cursor() as cur:
        text = {(v, c): t for v, c, t in cur.execute(
            "SELECT vacancy_id, chunk_idx, text FROM chunks WHERE list_contains(?, vacancy_id)",
            [list(seen)]).fetchall()}
    for h in hits:
        h["text"] = text.get((h["vacancy_id"], h.pop("chunk_idx")))
    return hits


@app.post("/similar_titles")
def similar_titles(r: TitleReq):
    score = (TI_EMB @ to_query(title_enc.encode([r.title.strip().lower()])[0])).float()
    top = score.topk(min(r.k, len(score)))
    return [{"title_norm": TI.title_norm.iat[i], "n_postings": int(TI.n_postings.iat[i]), "score": round(s, 4)}
            for s, i in zip(top.values.tolist(), top.indices.tolist())]


@app.post("/extract_skills")
def extract_skills(r: SkillsReq):
    sents = models.split_sentences(r.text)
    if not sents:
        return []
    best = {}  # skill -> (max score, evidence sentence)
    for s, k, v in zip(*matcher.match(sents, threshold=r.threshold)):
        skill = matcher.skills[k]
        if skill not in best or v > best[skill][0]:
            best[skill] = (float(v), sents[s])
    return [{"skill": k, "score": round(v, 4), "evidence": e}
            for k, (v, e) in sorted(best.items(), key=lambda x: -x[1][0])]


@app.post("/top_skills")
def top_skills(r: TopSkillsReq):
    # Only fixed SQL fragments are joined; all user input goes through ? parameters.
    conds, params = [], []
    if r.country:
        conds.append("country = ?")
        params.append(r.country.strip().upper())
    if r.company:
        conds.append("regexp_matches(company_norm, ?)")
        params.append(company_pattern(r.company))
    if r.year_from:
        conds.append("year(first_posted) >= ?")
        params.append(r.year_from)
    if r.year_to:
        conds.append("year(first_posted) <= ?")
        params.append(r.year_to)
    if r.title_contains:
        conds.append("contains(title_norm, ?)")
        params.append(r.title_contains.strip().lower())
    where = " AND ".join(conds) or "TRUE"
    with con.cursor() as cur:
        n = cur.execute(f"SELECT count(*) FROM postings WHERE {where}", params).fetchall()[0][0]
        rows = cur.execute(f"""
            SELECT skill, count(DISTINCT vacancy_id) AS n FROM posting_skills
            WHERE vacancy_id IN (SELECT vacancy_id FROM postings WHERE {where})
            GROUP BY skill ORDER BY n DESC, skill LIMIT ?""", params + [r.k]).fetchall()
    return {"n_postings": n,
            "skills": [{"skill": s, "n_postings": c, "share": round(c / n, 4)} for s, c in rows]}


class SqlReq(BaseModel):
    sql: str


@app.post("/company_sql")
def company_sql(r: SqlReq):
    """One read-only SELECT/WITH query over the SYNTHETIC company DB, max 200 rows."""
    sql = r.sql.strip().rstrip(";")
    if company is None:
        return {"error": "COMPANY_DB is not set"}
    if ";" in sql or not sql.lower().startswith(("select", "with")):
        return {"error": "only a single SELECT or WITH query is allowed"}
    try:
        with company.cursor() as cur:
            res = cur.execute(f"SELECT * FROM ({sql}) LIMIT 200")
            cols = [d[0] for d in res.description]
            return {"source": "SYNTHETIC - fictional Goldman Stanley for CenEkathon demo", "columns": cols,
                    "rows": [[py(v) for v in row] for row in res.fetchall()]}
    except duckdb.Error as e:
        return {"error": str(e)}


@app.get("/health")
def health():
    with con.cursor() as cur:
        counts = {t: cur.execute(f"SELECT count(*) FROM {t}").fetchall()[0][0]
                  for t in ("postings", "posting_ids", "chunks", "titles", "skills", "posting_skills")}
    if company is not None:
        with company.cursor() as cur:
            counts["company_employees"] = cur.execute("SELECT count(*) FROM employees").fetchall()[0][0]
    return {**counts, "device": models.DEVICE}


if company is not None:  # SYNTHETIC company endpoints: /company_profile, /skill_gap
    from company_api import router
    app.include_router(router)
