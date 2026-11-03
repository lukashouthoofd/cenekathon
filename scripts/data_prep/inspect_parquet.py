"""Inventory of the hackathon vacancy Parquet files (read-only on sources).

Usage: py -I scripts/inspect_parquet.py [--src-dir DIR] [--out-dir data]
Writes <out-dir>/metadata/parquet_inventory.md and parquet_schema.csv.
"""
import argparse
import csv
import glob
import hashlib
import os
from pathlib import Path

import duckdb
import pyarrow.parquet as pq

LOW_CARD = 50          # list values for columns with <= this many distinct values
ID_CANDIDATES = ("vacancy_id", "id", "job_id", "posting_id")
KEY_COLS = ("title", "company", "date_posted", "description")


def sha256(path, buf=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(buf):
            h.update(chunk)
    return h.hexdigest()


def q(s):
    return '"' + s.replace('"', '""') + '"'


def trunc(v, n=80):
    s = "" if v is None else str(v).replace("\n", " ").replace("\r", " ").replace("|", "\\|")
    return s if len(s) <= n else s[: n - 3] + "..."


def inspect(con, path):
    pf = pq.ParquetFile(path)
    schema = pf.schema_arrow
    src = f"read_parquet('{path.as_posix()}')"
    n = pf.metadata.num_rows
    cols = []
    for fld in schema:
        c = q(fld.name)
        nulls, nd = con.execute(
            f"select count(*) - count({c}), approx_count_distinct({c}) from {src}").fetchone()
        info = dict(column=fld.name, dtype=str(fld.type), null_count=nulls,
                    null_pct=round(100 * nulls / n, 4) if n else 0.0, n_distinct=nd)
        t = str(fld.type)
        if t.startswith("large_string") or t == "string":
            info["empty_str"] = con.execute(
                f"select count(*) from {src} where trim({c}) = ''").fetchone()[0]
            info["max_len"] = con.execute(f"select max(length({c})) from {src}").fetchone()[0]
        if "date" in t or "timestamp" in t:
            info["min"], info["max"] = con.execute(f"select min({c}), max({c}) from {src}").fetchone()
        if nd <= LOW_CARD:
            info["values"] = con.execute(
                f"select {c}, count(*) from {src} group by 1 order by 2 desc").fetchall()
        else:
            info["top"] = con.execute(
                f"select {c}, count(*) from {src} group by 1 order by 2 desc limit 5").fetchall()
        info["samples"] = [r[0] for r in con.execute(
            f"select {c} from {src} where {c} is not null using sample 3 rows (reservoir, 42)").fetchall()]
        cols.append(info)
    names = [f.name for f in schema]
    dup = {}
    idc = next((c for c in ID_CANDIDATES if c in names), None)
    if idc:
        dup["id_col"] = idc
        dup["id_dup_rows"] = con.execute(
            f"select count(*) - count(distinct {q(idc)}) from {src}").fetchone()[0]
    keys = [k for k in KEY_COLS if k in names]
    if keys:
        h = "hash(" + ", ".join(q(k) for k in keys) + ")"
        dup["key_cols"] = keys
        dup["key_dup_rows"] = con.execute(
            f"select count(*) - count(distinct {h}) from {src}").fetchone()[0]
    allh = "hash(" + ", ".join(q(k) for k in names) + ")"
    dup["full_row_dup_rows"] = con.execute(
        f"select count(*) - count(distinct {allh}) from {src}").fetchone()[0]
    return dict(file=path.name, size=path.stat().st_size, rows=n,
                row_groups=pf.metadata.num_row_groups, ncols=len(names),
                sha256=sha256(path), cols=cols, dup=dup)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src-dir", default=r"C:\Users\boton\Downloads")
    ap.add_argument("--out-dir", default="data")
    a = ap.parse_args()
    meta = Path(a.out_dir) / "metadata"
    meta.mkdir(parents=True, exist_ok=True)
    files = sorted(Path(p) for p in glob.glob(os.path.join(a.src_dir, "vacancies_*.parquet")))
    con = duckdb.connect()
    con.execute("set threads to 4; set memory_limit='6GB'")
    res = []
    for p in files:
        print("inspecting", p.name, flush=True)
        res.append(inspect(con, p))

    by_hash = {}
    for r in res:
        by_hash.setdefault(r["sha256"], []).append(r["file"])

    with open(meta / "parquet_schema.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "column", "dtype", "null_count", "null_pct", "n_distinct"])
        for r in res:
            for c in r["cols"]:
                w.writerow([r["file"], c["column"], c["dtype"], c["null_count"], c["null_pct"], c["n_distinct"]])

    L = ["# Parquet inventory", "",
         f"Source dir: `{a.src_dir}`. n_distinct is approximate (HyperLogLog, DuckDB approx_count_distinct).", "",
         "| file | size MB | rows | row groups | cols | date_posted min | max | id dups | full-row dups | sha256 (12) |",
         "|---|---:|---:|---:|---:|---|---|---:|---:|---|"]
    for r in res:
        d = next((c for c in r["cols"] if "min" in c), {})
        L.append(f"| {r['file']} | {r['size']/1e6:.1f} | {r['rows']:,} | {r['row_groups']} | {r['ncols']} | "
                 f"{d.get('min')} | {d.get('max')} | {r['dup'].get('id_dup_rows')} | "
                 f"{r['dup']['full_row_dup_rows']} | {r['sha256'][:12]} |")
    L.append("")
    for h, fs in by_hash.items():
        if len(fs) > 1:
            L.append(f"**Byte-identical files (sha256 {h[:12]}):** {', '.join(fs)} -> only one is used downstream.")
    L.append("")
    for r in res:
        L += [f"## {r['file']}", "", f"Rows {r['rows']:,}; duplicates: {r['dup']}", "",
              "| column | dtype | nulls | null % | empty str | ~distinct | max len | min | max |",
              "|---|---|---:|---:|---:|---:|---:|---|---|"]
        for c in r["cols"]:
            L.append(f"| {c['column']} | {c['dtype']} | {c['null_count']:,} | {c['null_pct']} | "
                     f"{c.get('empty_str', '')} | {c['n_distinct']:,} | {c.get('max_len', '')} | "
                     f"{c.get('min', '')} | {c.get('max', '')} |")
        L.append("")
        for c in r["cols"]:
            if "values" in c:
                L.append(f"- **{c['column']}** values: " + "; ".join(f"{trunc(v, 40)}={k:,}" for v, k in c["values"]))
            else:
                L.append(f"- **{c['column']}** top5: " + "; ".join(f"{trunc(v, 40)}={k:,}" for v, k in c["top"]))
            L.append(f"  - samples: " + " / ".join(f"`{trunc(s)}`" for s in c["samples"]))
        L.append("")
    (meta / "parquet_inventory.md").write_text("\n".join(L), encoding="utf-8")
    print("wrote", meta / "parquet_inventory.md", meta / "parquet_schema.csv")


if __name__ == "__main__":
    main()
