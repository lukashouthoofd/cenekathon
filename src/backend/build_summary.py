"""Compute real aggregates from the vacancy Parquet files and write data/summary.json.

The chat backend gives these numbers to Claude as context, so answers and dashboards
are based on the data rather than on invented figures. Run once: python src/backend/build_summary.py
Files are read one at a time to keep memory low.
"""
import collections
import glob
import json
import os

import duckdb

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
FILES = sorted(glob.glob(os.path.join(ROOT, "data", "vacancies_*.parquet")))
SKILLS = {
    "Python": r"\bpython\b",
    "SQL": r"\bsql\b",
    "Machine learning": r"machine learning",
    "Modelmonitoring / model risk": r"model (risk|monitoring|validation)",
    "Prompt engineering / LLM": r"\b(prompt|llm|generative ai|genai|large language model)",
    "AI Act / AI-regelgeving": r"\bai act\b",
    "Data governance": r"data governance",
    "Cloud (AWS/Azure/GCP)": r"\b(aws|azure|gcp|google cloud)\b",
}

con = duckdb.connect()
con.sql("set memory_limit='2GB'; set threads=2; set preserve_insertion_order=false")

per_year = collections.Counter()
per_country = collections.Counter()
per_year_country = collections.Counter()
companies = collections.Counter()
skill_per_year = {s: collections.Counter() for s in SKILLS}

for f in FILES:
    rel = f"read_parquet('{f}')"
    for y, n in con.sql(f"select year(date_posted) y, count(*) n from {rel} group by 1").fetchall():
        if y is not None:
            per_year[int(y)] += n
    for c, n in con.sql(f"select country, count(*) n from {rel} group by 1").fetchall():
        per_country[c] += n
    for y, c, n in con.sql(f"select year(date_posted) y, country, count(*) n from {rel} group by 1,2").fetchall():
        if y is not None:
            per_year_country[f"{int(y)}-{c}"] += n
    for c, n in con.sql(f"select lower(trim(company)) c, count(*) n from {rel} group by 1").fetchall():
        companies[c] += n
    for label, pattern in SKILLS.items():
        rows = con.sql(
            f"select year(date_posted) y, count(*) n from {rel} "
            f"where regexp_matches(lower(title || ' ' || description), '{pattern}') group by 1"
        ).fetchall()
        for y, n in rows:
            if y is not None:
                skill_per_year[label][int(y)] += n
    print("done", os.path.basename(f), flush=True)

total = sum(per_country.values())
summary = {
    "total_postings": total,
    "per_year": dict(sorted(per_year.items())),
    "per_country": dict(per_country.most_common()),
    "per_year_country": dict(sorted(per_year_country.items())),
    "top_companies_lowercase": [{"company": c, "postings": n} for c, n in companies.most_common(15)],
    "skill_postings_per_year": {s: dict(sorted(v.items())) for s, v in skill_per_year.items()},
    "skill_share_of_postings_per_year": {
        s: {y: round(v.get(y, 0) / per_year[y], 4) for y in sorted(per_year)}
        for s, v in skill_per_year.items()
    },
    "notes": [
        "Postings are mostly English (about three quarters UK). Skill matches are keyword matches on title and description, not verified skill labels.",
        "Data collection was incomplete from January to April 2026.",
        "Company names are as posted; the same employer can appear under several spellings (e.g. 'ING' and 'ING Netherlands').",
    ],
}
out = os.path.join(ROOT, "data", "summary.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(summary, fh, ensure_ascii=False, indent=2)
print("wrote", out, "total", total)
