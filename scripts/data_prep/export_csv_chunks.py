"""Split the cleaned vacancies into CSV chunks small enough for GitHub (< 100 MB per file).

Reads data/processed/vacancies_text.parquet and writes
data/processed/vacancies_clean_csv/vacancies_clean_<year>_<nn>.csv, ordered by source file and row.
Any chunk over --max-mb is re-split automatically. DuckDB is used in memory only.

Load all chunks in DuckDB with:
  read_csv('data/processed/vacancies_clean_csv/*.csv', quote='"', escape='"', header=true,
           all_varchar=true, max_line_size=20000000)

Usage: py -I scripts/export_csv_chunks.py [--data-dir data] [--rows 18000] [--max-mb 95]
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import duckdb

COLUMNS = ("vacancy_id, date_posted, country, city, company, title_clean, description_clean, "
           "is_duplicate, is_content_duplicate, source_file, source_row")
CSV_OUT = "FORMAT csv, HEADER, QUOTE '\"', ESCAPE '\"', DATEFORMAT '%Y-%m-%d'"


def write_chunk(con, src: str, where: str, lo: int, hi: int, path: Path, max_bytes: int) -> list[Path]:
    con.execute(f"""COPY (SELECT {COLUMNS} FROM {src}
                    WHERE {where} AND rn >= {lo} AND rn < {hi} ORDER BY rn)
                    TO '{path.as_posix()}' ({CSV_OUT})""")
    if path.stat().st_size <= max_bytes or hi - lo <= 1:
        return [path]
    # Too big: split this range in two and retry.
    path.unlink()
    mid = (lo + hi) // 2
    return (write_chunk(con, src, where, lo, mid, path.with_name(path.stem + "a.csv"), max_bytes)
            + write_chunk(con, src, where, mid, hi, path.with_name(path.stem + "b.csv"), max_bytes))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--rows", type=int, default=18000)
    ap.add_argument("--max-mb", type=float, default=95)
    args = ap.parse_args()

    data = Path(args.data_dir)
    out = data / "processed/vacancies_clean_csv"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    con = duckdb.connect()
    # Number rows within each year once, in original order, so chunks are stable across runs.
    con.execute(f"""CREATE TEMP TABLE v AS
        SELECT *, CAST(regexp_extract(source_file, '(\\d{{4}})', 1) AS INT) AS year,
               row_number() OVER (PARTITION BY source_file ORDER BY source_row) - 1 AS rn
        FROM read_parquet('{(data / "processed/vacancies_text.parquet").as_posix()}')""")
    max_bytes = int(args.max_mb * 1e6)
    files: list[Path] = []
    for year, n in con.execute("SELECT year, count(*) FROM v GROUP BY year ORDER BY year").fetchall():
        for i, lo in enumerate(range(0, n, args.rows)):
            p = out / f"vacancies_clean_{year}_{i:02d}.csv"
            files += write_chunk(con, "v", f"year = {year}", lo, lo + args.rows, p, max_bytes)
        print(f"{year}: {n} rows", flush=True)

    total = con.execute(f"""SELECT count(*) FROM read_csv('{out.as_posix()}/*.csv', quote='"', escape='"',
        header=true, all_varchar=true, max_line_size=20000000)""").fetchone()[0]
    sizes = [f.stat().st_size for f in files]
    print(f"chunks={len(files)} rows={total} max_mb={max(sizes) / 1e6:.1f} total_mb={sum(sizes) / 1e6:.0f}")


if __name__ == "__main__":
    main()
