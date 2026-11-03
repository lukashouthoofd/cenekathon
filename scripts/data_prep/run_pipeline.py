"""Run the full data preparation pipeline: inspect -> prepare -> collect -> validate.

Usage: py -I scripts/run_pipeline.py [--src-dir DIR] [--skip-inspect] [--skip-external]
Extra args after `--` are passed to collect_external_data.py.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[1]  # repo root (scripts/data_prep/ -> repo)


def step(name: str, *args: str) -> None:
    print(f"\n=== {name} ===", flush=True)
    t = time.time()
    # -I keeps the interpreter isolated from the data folders.
    r = subprocess.run([sys.executable, "-I", str(SCRIPTS / name), *args], cwd=ROOT)
    if r.returncode != 0:
        sys.exit(f"{name} failed with exit code {r.returncode}")
    print(f"--- {name} done in {time.time() - t:.0f}s", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src-dir", default=r"C:\Users\boton\Downloads",
                    help="folder holding the hackathon vacancies_*.parquet files")
    ap.add_argument("--skip-inspect", action="store_true")
    ap.add_argument("--skip-external", action="store_true")
    args, extra = ap.parse_known_args()
    extra = [a for a in extra if a != "--"]

    if not args.skip_inspect:
        step("inspect_parquet.py", "--src-dir", args.src_dir)
    step("prepare_vacancies.py", "--src-dir", args.src_dir)
    step("prepare_text_export.py")
    if not args.skip_external:
        step("collect_external_data.py", *extra)
    step("validate_data.py")
    print("\nPipeline finished. See data/metadata/validation_report.md")


if __name__ == "__main__":
    main()
