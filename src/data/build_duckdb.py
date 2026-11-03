"""Build the DuckDB store from the normalized vacancy Parquet file.

Rerun this script after every new normalization so the database stays in sync.
"""

import datetime
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "vacancies_normalized.parquet"
TARGET = HERE / "vacancies.duckdb"


def build() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing normalized input: {SOURCE}")

    # Build into a temporary file first, so a failed run never leaves a half-written database.
    temp = TARGET.with_suffix(".duckdb.tmp")
    if temp.exists():
        temp.unlink()

    con = duckdb.connect(str(temp))
    try:
        con.execute(
            "CREATE TABLE vacancies AS SELECT * FROM read_parquet(?)",
            [str(SOURCE)],
        )
        con.execute(
            """
            CREATE TABLE build_info (
                built_at TIMESTAMP,
                source_file VARCHAR,
                row_count BIGINT
            )
            """
        )
        row_count = con.execute("SELECT count(*) FROM vacancies").fetchone()[0]
        con.execute(
            "INSERT INTO build_info VALUES (?, ?, ?)",
            [datetime.datetime.now(), SOURCE.name, row_count],
        )
        # Flush the WAL into the file, so no .wal is left next to the database for readers to trip over.
        con.execute("CHECKPOINT")
    finally:
        con.close()

    if TARGET.exists():
        TARGET.unlink()
    temp.rename(TARGET)
    print(f"Built {TARGET.name} with {row_count} rows.")


if __name__ == "__main__":
    build()
