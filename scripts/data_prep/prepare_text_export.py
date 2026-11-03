"""Write a cleaned-text copy of the vacancies for downstream text/RAG work.

Reads data/processed/vacancies.parquet and writes data/processed/vacancies_text.parquet with
HTML tags stripped, common HTML entities decoded and whitespace collapsed. Original columns
in vacancies.parquet are untouched; this file only adds `title_clean` / `description_clean`.
DuckDB is used in memory as a transformation engine only (no database file is created).

Usage: py -I scripts/prepare_text_export.py [--data-dir data]
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import duckdb

ENTITIES = {"&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
            "&#39;": "'", "&apos;": "'", "&rsquo;": "'", "&lsquo;": "'", "&ndash;": "-",
            "&mdash;": "-", "&euro;": "€", "&pound;": "£", "&bull;": "•", "&hellip;": "..."}


def clean_sql(col: str) -> str:
    expr = f"regexp_replace({col}, '<(br|/p|/li|/div|/h[1-6])[^>]*>', '\n', 'gi')"
    expr = f"regexp_replace({expr}, '<[^>]+>', ' ', 'g')"
    for ent, ch in ENTITIES.items():
        expr = f"replace({expr}, '{ent}', '{ch.replace(chr(39), chr(39) * 2)}')"
    expr = f"regexp_replace({expr}, '[ \t\r\f\v]+', ' ', 'g')"
    expr = f"regexp_replace({expr}, '\\s*\n\\s*(\n\\s*)+', '\n\n', 'g')"
    return f"nullif(trim({expr}), '')"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    args = ap.parse_args()
    src = Path(args.data_dir) / "processed/vacancies.parquet"
    out = Path(args.data_dir) / "processed/vacancies_text.parquet"
    tmp = out.with_suffix(".parquet.tmp")

    con = duckdb.connect()
    con.execute(f"""
        COPY (
            SELECT vacancy_id, date_posted, country, trim(city) AS city, trim(company) AS company,
                   title, {clean_sql('title')} AS title_clean,
                   {clean_sql('description')} AS description_clean,
                   is_duplicate, is_content_duplicate, source_file, source_row
            FROM read_parquet('{src.as_posix()}')
        ) TO '{tmp.as_posix()}' (FORMAT parquet, COMPRESSION zstd)
    """)
    os.replace(tmp, out)
    n, html_left = con.execute(f"""
        SELECT count(*), count(*) FILTER (WHERE regexp_matches(description_clean, '<[a-zA-Z/][^>]*>'))
        FROM read_parquet('{out.as_posix()}')""").fetchone()
    print(f"wrote {out} rows={n} size_mb={out.stat().st_size / 1e6:.1f} residual_html_rows={html_left}")


if __name__ == "__main__":
    main()
