"""Build the fast keyword RAG index (DuckDB full-text search, BM25) for the demo.

Rerun after build_duckdb.py:  py -3 build_rag.py
Reads vacancies.duckdb (this folder) and data/external/*.csv (repo root). Writes rag.duckdb (this folder).
One table `docs` with an FTS index over title + text. No GPU or embeddings: builds in minutes on a laptop.
"""

from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
EXTERNAL = HERE.parents[1] / "data" / "external"
VACANCIES = HERE / "vacancies.duckdb"
TARGET = HERE / "rag.duckdb"

DEMO_YEARS = (2025, 2026)  # the demo scope; trends over all years come from vacancies.duckdb directly
TEXT_CHARS = 4000  # indexed text per vacancy; the full description stays in vacancies.duckdb

DOCS = f"""
CREATE TABLE docs AS
-- Vacancies: one per non-duplicate posting in the four demo countries, HTML stripped.
SELECT vacancy_id AS doc_id, 'vacancy' AS kind, title,
       left(trim(regexp_replace(regexp_replace(replace(replace(description, '&nbsp;', ' '), '&amp;', '&'),
            '<[^>]*>', ' ', 'g'), '\\s+', ' ', 'g')), {TEXT_CHARS}) AS text,
       company, country, date_posted, CAST(NULL AS VARCHAR) AS source
FROM vac.vacancies
WHERE year(date_posted) BETWEEN {DEMO_YEARS[0]} AND {DEMO_YEARS[1]}
  AND country IN ('BE', 'NL', 'LU', 'GB') AND NOT possible_duplicate

UNION ALL
-- ESCO skills, with Dutch and French labels so a query in any of the three languages finds them.
SELECT 'esco:' || skill_id, 'skill', preferred_label_en,
       concat_ws(' | ', preferred_label_nl, preferred_label_fr,
                 replace(alt_labels_en, '|', ', '), replace(alt_labels_nl, '|', ', '), replace(alt_labels_fr, '|', ', '),
                 description_en, skill_type),
       NULL, NULL, NULL, 'ESCO'
FROM read_csv('{(EXTERNAL / "skills.csv").as_posix()}')

UNION ALL
-- AI exposure per occupation or industry: all indicators of one source and code in one document.
SELECT source || ':' || classification || ':' || code, 'ai_exposure', title,
       source || ' (' || classification || ' ' || code || ', ' || any_value(geo) || '): '
         || string_agg(indicator_label || ' = ' || round(value, 3) || ' ' || unit, '; ' ORDER BY indicator),
       NULL, NULL, NULL, source
FROM read_csv('{(EXTERNAL / "ai_research_data.csv").as_posix()}')
WHERE title IS NOT NULL AND value IS NOT NULL
GROUP BY source, classification, code, title
"""


def build() -> None:
    if not VACANCIES.exists():
        raise FileNotFoundError(f"Missing {VACANCIES}: run build_duckdb.py first")

    temp = TARGET.with_suffix(".duckdb.tmp")
    if temp.exists():
        temp.unlink()

    con = duckdb.connect(str(temp))
    try:
        con.execute(f"ATTACH '{VACANCIES.as_posix()}' AS vac (READ_ONLY)")
        con.execute(DOCS)
        con.execute("DETACH vac")
        con.execute("INSTALL fts; LOAD fts")
        # English stemming: about three quarters of the postings are from the UK. Dutch/French still match on exact words.
        con.execute("PRAGMA create_fts_index('docs', 'doc_id', 'title', 'text', stemmer = 'english', strip_accents = 1)")
        counts = con.execute("SELECT kind, count(*) FROM docs GROUP BY 1 ORDER BY 1").fetchall()
        con.execute("CHECKPOINT")
    finally:
        con.close()

    if TARGET.exists():
        TARGET.unlink()
    temp.rename(TARGET)
    print(f"Built {TARGET.name}: " + ", ".join(f"{k} {n}" for k, n in counts))


if __name__ == "__main__":
    build()
