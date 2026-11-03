"""Upload vacancies.duckdb and rag.duckdb to MotherDuck as databases `vacancies` and `rag`.

Rerun after build_duckdb.py / build_rag.py:  MOTHERDUCK_TOKEN=... py -3 upload_motherduck.py
Replaces the databases if they exist. The app then reads them with VACANCY_DB_PATH=md:vacancies and RAG_DB_PATH=md:rag.
Needs duckdb 1.5.x: MotherDuck does not support DuckDB 2.0 yet.
"""

import os
import time
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
DATABASES = {"vacancies": HERE / "vacancies.duckdb", "rag": HERE / "rag.duckdb"}


def upload() -> None:
    if not os.environ.get("MOTHERDUCK_TOKEN"):
        raise SystemExit("Set MOTHERDUCK_TOKEN first (MotherDuck > Settings > Access tokens).")
    for path in DATABASES.values():
        if not path.exists():
            raise FileNotFoundError(f"Missing {path}: build it first")

    con = duckdb.connect("md:")
    try:
        for name, path in DATABASES.items():
            start = time.time()
            con.execute(f"CREATE OR REPLACE DATABASE {name} FROM '{path.as_posix()}'")
            print(f"Uploaded {path.name} as md:{name} in {time.time() - start:.0f} s")
    finally:
        con.close()


if __name__ == "__main__":
    upload()
