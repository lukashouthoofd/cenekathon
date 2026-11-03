"""Build a small, seeded sample of 2021 vacancies for use as examples.

Writes data/examples_2021.json (git-ignored: licensed data, team use only).
Run from anywhere: python src/backend/build_examples.py
"""
import json
import random
import re
from datetime import date
from pathlib import Path

import duckdb

from company_names import normalise_company

SEED = 42
QUOTAS = {"NL": 2, "BE": 2, "LU": 2, "GB": 6}
MIN_SKILL_POSTINGS = 3
EXCERPT_LEN = 300
# Postings that mention a skill we want the sample to show (case-insensitive).
SKILL_RE = r"\bpython\b|\bsql\b|machine[ -]learning"

ROOT = Path(__file__).resolve().parents[2]
PARQUET_CANDIDATES = [ROOT / "data" / "vacancies_2021.parquet", ROOT / "vacancies_2021.parquet"]
OUT_PATH = ROOT / "data" / "examples_2021.json"

# Label -> regex, applied to the lowercased title + cleaned description.
SKILLS = [
    ("Python", r"\bpython\b"),
    ("SQL", r"\bsql\b"),
    ("Machine learning", r"machine[ -]learning"),
    ("Prompt engineering / LLM", r"prompt engineering|\bllms?\b|large language model|generative ai|\bgenai\b"),
    ("Cloud (AWS/Azure/GCP)", r"\baws\b|\bazure\b|\bgcp\b|google cloud"),
    ("Data governance", r"data governance"),
    ("Modelmonitoring / model risk", r"model ?monitoring|model risk"),
    ("AI Act / AI-regelgeving", r"\bai act\b|ai-regelgeving|\bai-verordening"),
]


def clean_text(html):
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def pick_ids(con, src):
    """Return (chosen vacancy_ids in order, {vacancy_id: country}, {vacancy_id: has_skill})."""
    countries = list(QUOTAS)
    placeholders = ",".join("?" * len(countries))
    rows = con.execute(
        f"SELECT vacancy_id, country, "
        f"regexp_matches(coalesce(title, '') || ' ' || coalesce(description, ''), ?, 'i') "
        f"FROM read_parquet(?) WHERE country IN ({placeholders}) ORDER BY vacancy_id",
        [SKILL_RE, src, *countries],
    ).fetchall()

    pools = {c: [] for c in countries}
    country_of, has_skill = {}, {}
    for vid, country, skill in rows:
        pools[country].append(vid)
        country_of[vid] = country
        has_skill[vid] = bool(skill)

    rng = random.Random(SEED)
    chosen = []
    for country, n in QUOTAS.items():
        chosen += rng.sample(pools[country], min(n, len(pools[country])))

    # Make sure the sample shows skills: swap non-skill GB picks for skill-matching GB posts.
    deficit = MIN_SKILL_POSTINGS - sum(has_skill[v] for v in chosen)
    if deficit > 0:
        spare = [v for v in pools["GB"] if has_skill[v] and v not in chosen]
        swappable = [i for i, v in enumerate(chosen) if country_of[v] == "GB" and not has_skill[v]]
        for i, new in zip(swappable[:deficit], rng.sample(spare, deficit)):
            chosen[i] = new
    return chosen, country_of, has_skill


def main():
    src = next(p for p in PARQUET_CANDIDATES if p.exists()).as_posix()
    con = duckdb.connect()
    chosen, _, _ = pick_ids(con, src)

    placeholders = ",".join("?" * len(chosen))
    fetched = {
        r[0]: r
        for r in con.execute(
            f"SELECT vacancy_id, title, description, company, date_posted, country, city "
            f"FROM read_parquet(?) WHERE vacancy_id IN ({placeholders})",
            [src, *chosen],
        ).fetchall()
    }

    examples = []
    for vid in chosen:
        vid, title, description, company, posted, country, city = fetched[vid]
        text = clean_text(description)
        excerpt = text[:EXCERPT_LEN] + "…" if len(text) > EXCERPT_LEN else text
        haystack = f"{title or ''} {text}".lower()
        examples.append({
            "id": vid,
            "title": title,
            "company": normalise_company(company),
            "date_posted": posted.isoformat() if isinstance(posted, date) else None,
            "country": country,
            "city": city,
            "skills_mentioned": [label for label, pat in SKILLS if re.search(pat, haystack)],
            "excerpt": excerpt,
        })

    out = {
        "source": "vacancies_2021.parquet",
        "note": "Voorbeeldvacatures, gesimuleerd via steekproef; team use only",
        "examples": examples,
    }
    OUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    per_country = {c: sum(e["country"] == c for e in examples) for c in QUOTAS}
    with_skill = sum(bool(e["skills_mentioned"]) for e in examples)
    print(f"wrote {OUT_PATH.name}: {len(examples)} examples")
    print(f"per country: {per_country}")
    print(f"with at least one skill: {with_skill}")


if __name__ == "__main__":
    main()
