"""Validate exported files: row counts, missing values, duplicates, source coverage.

Writes data/metadata/validation_report.md and data/metadata/validation_columns.csv.
Usage: py -I scripts/validate_data.py [--data-dir data]
"""
from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

EXPECTED = [
    "processed/vacancies.csv",
    "external/skills.csv",
    "external/occupations.csv",
    "external/companies.csv",
    "external/labour_market_data.csv",
    "external/ai_research_data.csv",
    "metadata/sources.csv",
]
# Columns tried, in order, as the record key for duplicate checks.
KEY_CANDIDATES = ["vacancy_id", "id", "uri", "concept_uri", "skill_id", "occupation_id", "company_id"]
# Explicit options: DuckDB's CSV sniffer trips on long multi-line descriptions.
CSV_OPTS = "quote='\"', escape='\"', header=true, all_varchar=true, max_line_size=20000000"


def relation(path: Path) -> str:
    p = str(path).replace("\\", "/").replace("'", "''")
    if path.suffix == ".parquet":
        return f"read_parquet('{p}')"
    return f"read_csv('{p}', {CSV_OPTS})"


def q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def validate_file(path: Path, data_dir: Path) -> tuple[dict, list[dict]]:
    con = duckdb.connect()  # in-memory, used only for these checks
    rel = relation(path)
    cols = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM {rel}").fetchall()]
    null_exprs = ", ".join(f"count(*) - count({q(c)})" for c in cols)
    row = con.execute(f"SELECT count(*), {null_exprs} FROM {rel}").fetchone()
    rows, nulls = row[0], dict(zip(cols, row[1:]))

    key = next((k for k in KEY_CANDIDATES if k in cols), None)
    key_dupes = None
    if key:
        key_dupes = rows - nulls[key] - con.execute(f"SELECT count(DISTINCT {q(key)}) FROM {rel}").fetchone()[0]
    # Full-row duplicates via a row hash, so wide text columns stay cheap.
    # source_row is unique by construction, so leave it out of the content hash.
    hash_cols = [c for c in cols if c != "source_row"] or cols
    row_dupes = rows - con.execute(f"SELECT count(DISTINCT hash({', '.join(q(c) for c in hash_cols)})) FROM {rel}").fetchone()[0]
    flagged = None
    if "is_duplicate" in cols:
        flagged = con.execute(f"SELECT count(*) FROM {rel} WHERE lower(CAST(is_duplicate AS VARCHAR)) IN ('true','1')").fetchone()[0]
    con.close()

    summary = {
        "file": str(path.relative_to(data_dir)).replace("\\", "/"),
        "size_mb": round(path.stat().st_size / 1e6, 1),
        "rows": rows,
        "columns": len(cols),
        "key_column": key or "",
        "duplicate_keys": "" if key_dupes is None else key_dupes,
        "duplicate_rows": row_dupes,
        "flagged_is_duplicate": "" if flagged is None else flagged,
        "cells_missing_pct": round(100 * sum(nulls.values()) / max(rows * len(cols), 1), 2),
    }
    per_col = [
        {"file": summary["file"], "column": c, "null_count": nulls[c],
         "null_pct": round(100 * nulls[c] / rows, 2) if rows else 0.0}
        for c in cols
    ]
    return summary, per_col


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    args = ap.parse_args()
    data_dir = Path(args.data_dir)

    issues: list[str] = []
    targets = []
    for rel in EXPECTED:
        p = data_dir / rel
        if not p.exists():
            issues.append(f"MISSING: {rel}")
        else:
            targets.append(p)
    parquet = data_dir / "processed/vacancies.parquet"
    if parquet.exists():
        targets.insert(0, parquet)

    summaries, columns = [], []
    for p in targets:
        print(f"validating {p} ...", flush=True)
        try:
            s, c = validate_file(p, data_dir)
        except Exception as e:  # report and keep going
            issues.append(f"ERROR reading {p.name}: {e}")
            continue
        summaries.append(s)
        columns.extend(c)
        if s["rows"] == 0:
            issues.append(f"EMPTY: {s['file']}")
        if s["file"].startswith("external/") and "source" not in [x["column"] for x in c if x["file"] == s["file"]]:
            issues.append(f"NO source COLUMN: {s['file']}")

    # Every external file must be documented in sources.csv.
    src = data_dir / "metadata/sources.csv"
    if src.exists():
        with src.open(encoding="utf-8") as f:
            documented = {r.get("output_file", "").replace("\\", "/") for r in csv.DictReader(f)}
        for rel in EXPECTED:
            if rel.startswith("external/") and not any(d.endswith(rel) for d in documented):
                issues.append(f"UNDOCUMENTED in sources.csv: {rel}")

    originals = sorted((data_dir / "original").glob("*.parquet"))

    out = data_dir / "metadata"
    with (out / "validation_columns.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["file", "column", "null_count", "null_pct"])
        w.writeheader()
        w.writerows(columns)

    lines = [
        "# Validation report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        f"Original Parquet files in data/original: {len(originals)} ({', '.join(p.name for p in originals)})",
        "",
        "## Files",
        "",
        "| file | size MB | rows | cols | key | dup keys | dup rows | flagged dup | % cells missing |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for s in summaries:
        lines.append("| " + " | ".join(str(v) for v in s.values()) + " |")
    lines += ["", "## Columns with missing values", "",
              "| file | column | nulls | % |", "|---|---|---|---|"]
    for c in columns:
        if c["null_count"]:
            lines.append(f"| {c['file']} | {c['column']} | {c['null_count']} | {c['null_pct']} |")
    lines += ["", "## Issues", ""] + ([f"- {i}" for i in issues] or ["- none"])
    (out / "validation_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("\n".join(lines[:12 + len(summaries)]))
    print("\nIssues:", *(issues or ["none"]), sep="\n- ")
    return 1 if any(i.startswith(("MISSING", "ERROR")) for i in issues) else 0


if __name__ == "__main__":
    sys.exit(main())
