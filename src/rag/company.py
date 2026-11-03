"""Build company.duckdb: the SYNTHETIC Goldman Stanly tables (data/synthetic/*.csv) plus market-model enrichments.

  python3 company.py --synthetic-dir data/synthetic --rag-db rag.duckdb --out company.duckdb

Loads every CSV as a table (is_synthetic kept), then adds:
  title_map(job_title, market_title_norm, n_postings, score)  JobBERT-v3 top 5 rag titles per internal
                                                              job_architecture.job_title and base_title
  job_skill_esco(job_id, skill_name, skill, match_score)      job_skills.skill_name -> rag `skills` label:
                                                              exact (case-insensitive), else ConTeXT cosine >= 0.8, else NULL
  _meta(source, as_of)                                        as_of = last date in ai_usage_logs
"""
import argparse
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import torch

import models

SOURCE = "SYNTHETIC - fictional Goldman Stanly for CenEkathon demo"
TABLES = ["departments", "job_architecture", "job_skills", "employees", "headcount_monthly", "ai_usage_logs",
          "model_pricing", "courses", "learning_records", "recruiting_records"]
SKILL_COS = 0.8


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic-dir", required=True)
    ap.add_argument("--rag-db", required=True)
    ap.add_argument("--out", default="company.duckdb")
    a = ap.parse_args()

    out = Path(a.out)
    out.unlink(missing_ok=True)
    con = duckdb.connect(str(out))
    for t in TABLES:
        path = (Path(a.synthetic_dir) / f"{t}.csv").resolve().as_posix()
        con.execute(f"CREATE TABLE {t} AS SELECT * FROM read_csv('{path}', header = true, sample_size = -1)")
    rag = duckdb.connect(a.rag_db, read_only=True)

    # title_map: top 5 market titles per internal job title and base title
    titles = [t for (t,) in con.execute("SELECT job_title FROM job_architecture UNION "
                                        "SELECT base_title FROM job_architecture ORDER BY 1").fetchall()]
    mt = rag.execute("SELECT title_norm, n_postings, emb FROM titles").fetchall()
    M = np.array([r[2] for r in mt], dtype=np.float32)
    sim = models.TitleEncoder().encode([t.lower() for t in titles]) @ M.T
    rows = [(t, mt[j][0], mt[j][1], float(sim[i, j]))
            for i, t in enumerate(titles) for j in np.argsort(-sim[i])[:5]]
    tm = pd.DataFrame(rows, columns=["job_title", "market_title_norm", "n_postings", "score"])
    con.execute("CREATE TABLE title_map AS SELECT *, true AS is_synthetic FROM tm")

    # job_skill_esco: exact label match first, else nearest ESCO label by ConTeXT sentence embedding
    labels = [s for (s,) in rag.execute("SELECT skill FROM skills ORDER BY skill_id").fetchall()]
    by_lower = {s.lower(): s for s in labels}
    names = [n for (n,) in con.execute("SELECT DISTINCT skill_name FROM job_skills ORDER BY 1").fetchall()]
    mapping = {n: (by_lower[n.lower()], 1.0) for n in names if n.lower() in by_lower}
    rest = [n for n in names if n not in mapping]
    if rest:
        matcher = models.SkillMatcher(labels)
        S = torch.nn.functional.normalize(matcher.S, dim=1)
        Q = matcher.model.encode(rest, convert_to_tensor=True, normalize_embeddings=True).float()
        best, idx = (Q @ S.T).max(dim=1)
        for n, b, i in zip(rest, best.tolist(), idx.tolist()):
            mapping[n] = (labels[i], b) if b >= SKILL_COS else (None, b)
    m = pd.DataFrame([(n, s, round(v, 4)) for n, (s, v) in mapping.items()],
                     columns=["skill_name", "skill", "match_score"])
    con.execute("""CREATE TABLE job_skill_esco AS SELECT j.job_id, j.skill_name, m.skill, m.match_score,
                   true AS is_synthetic FROM job_skills j JOIN m USING (skill_name) ORDER BY 1, 2""")

    con.execute(f"CREATE TABLE _meta AS SELECT '{SOURCE}' AS source, max(date) AS as_of, true AS is_synthetic "
                "FROM ai_usage_logs")

    n_null = sum(s is None for s, _ in mapping.values())
    print(f"skill names: {len(names)} distinct, {len(names) - len(rest)} exact, {len(rest) - n_null} embedding, "
          f"{n_null} unmatched")
    for (t,) in con.execute("SELECT table_name FROM duckdb_tables() ORDER BY 1").fetchall():
        print(f"{t:24s} {con.execute(f'SELECT count(*) FROM {t}').fetchall()[0][0]:7d} rows")
    con.close()


if __name__ == "__main__":
    main()
