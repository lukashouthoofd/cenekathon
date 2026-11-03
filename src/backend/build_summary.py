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

from company_names import normalise_company

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
raw_companies = collections.Counter()
skill_per_year = {s: collections.Counter() for s in SKILLS}
# Per canonical company: postings per year, and for 2025 the total and skill-keyword counts.
company_year = collections.defaultdict(collections.Counter)
company_2025 = collections.Counter()
company_skill_2025 = collections.defaultdict(collections.Counter)
raw_rows = 0

for f in FILES:
    rel = f"read_parquet('{f}')"
    raw_rows += con.sql(f"select count(*) from {rel}").fetchall()[0][0]
    # Dedupe: identical (title, company, date_posted, country) counts once; keyword flags are kept per group.
    flags = ", ".join(
        f"bool_or(regexp_matches(lower(title || ' ' || description), '{p}')) s{i}"
        for i, p in enumerate(SKILLS.values())
    )
    con.sql(
        f"create or replace temp table d as select title, company, date_posted, country, {flags} "
        f"from {rel} group by 1,2,3,4"
    )
    for y, n in con.sql("select year(date_posted) y, count(*) n from d group by 1").fetchall():
        if y is not None:
            per_year[int(y)] += n
    for c, n in con.sql("select country, count(*) n from d group by 1").fetchall():
        per_country[c] += n
    for y, c, n in con.sql("select year(date_posted) y, country, count(*) n from d group by 1,2").fetchall():
        if y is not None:
            per_year_country[f"{int(y)}-{c}"] += n
    for c, n in con.sql("select company, count(*) n from d group by 1").fetchall():
        raw_companies[c] += n
    for i, label in enumerate(SKILLS):
        for y, n in con.sql(f"select year(date_posted) y, count(*) n from d where s{i} group by 1").fetchall():
            if y is not None:
                skill_per_year[label][int(y)] += n
    flag_cols = ", ".join(f"s{i}" for i in range(len(SKILLS)))
    group_cols = ", ".join(str(k) for k in range(1, len(SKILLS) + 3))
    for c, y, *flags, n in con.sql(
        f"select lower(trim(company)) c, year(date_posted) y, {flag_cols}, count(*) n "
        f"from d group by {group_cols}"
    ).fetchall():
        canon = normalise_company(c)
        if canon is None:
            continue
        if y is not None:
            company_year[canon][int(y)] += n
        if y == 2025:
            company_2025[canon] += n
            for label, flag in zip(SKILLS, flags):
                if flag:
                    company_skill_2025[canon][label] += n
    print("done", os.path.basename(f), flush=True)

total = sum(per_country.values())
duplicates_removed = raw_rows - total

companies = collections.Counter()
canonical_of = {}
for raw, n in raw_companies.items():
    canon = normalise_company(raw)
    canonical_of[raw] = canon
    if canon is not None:
        companies[canon] += n
raw_names = len({r for r, c in canonical_of.items() if c is not None})
collapsed = raw_names - len(companies)

per_company = []
for c, n in companies.most_common(30):
    n_2025 = company_2025[c]
    per_company.append({
        "company": c,
        "postings_total": n,
        "postings_per_year": dict(sorted(company_year[c].items())),
        "skill_keyword_share_2025": None if n_2025 == 0 else {
            s: round(company_skill_2025[c][s] / n_2025, 4) for s in SKILLS
        },
    })

summary = {
    "total_postings": total,
    "per_year": dict(sorted(per_year.items())),
    "per_country": dict(per_country.most_common()),
    "per_year_country": dict(sorted(per_year_country.items())),
    "top_companies": [{"company": c, "postings": n} for c, n in companies.most_common(15)],
    "per_company": per_company,
    "company_names": {
        "distinct_raw_names": raw_names,
        "distinct_canonical_names": len(companies),
        "raw_names_collapsed": collapsed,
    },
    "duplicates_removed": duplicates_removed,
    "skill_keyword_postings_per_year": {s: dict(sorted(v.items())) for s, v in skill_per_year.items()},
    "skill_keyword_share_of_postings_per_year": {
        s: {y: round(v.get(y, 0) / per_year[y], 4) for y in sorted(per_year)}
        for s, v in skill_per_year.items()
    },
    "notes": [
        "Postings are mostly English (about three quarters UK). Skill figures are keyword matches on title and description, not verified skill labels.",
        "Data collection was incomplete from January to April 2026.",
        "per_company skill shares are keyword matches on the title and description of that company's 2025 postings, not verified skill labels.",
        f"All counts are after removing {duplicates_removed} duplicate postings (same title, company, date_posted and country); {raw_rows} raw rows.",
        f"Company names are normalised (lowercase, legal suffixes stripped, a few verified aliases merged): {raw_names} raw names became {len(companies)}. Other spellings of the same employer may remain.",
    ],
}

# Sanity checks: fail loudly rather than hand Claude inconsistent numbers.
problems = []
if total != sum(per_country.values()):
    problems.append("total != sum(per_country)")
if sum(per_year.values()) > total:
    problems.append("sum(per_year) > total")
for s, by_year in summary["skill_keyword_share_of_postings_per_year"].items():
    if any(not 0 <= v <= 1 for v in by_year.values()):
        problems.append(f"share outside 0..1 for {s}")
if sum(c["postings_total"] for c in per_company) > total:
    problems.append("sum(per_company postings_total) > total")
for c in per_company:
    for s, v in (c["skill_keyword_share_2025"] or {}).items():
        if not 0 <= v <= 1:
            problems.append(f"per_company share outside 0..1 for {c['company']} / {s}")
if problems:
    raise SystemExit("Sanity check failed: " + "; ".join(problems))
out = os.path.join(ROOT, "data", "summary.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(summary, fh, ensure_ascii=False, indent=2)
print("wrote", out, "total", total)
