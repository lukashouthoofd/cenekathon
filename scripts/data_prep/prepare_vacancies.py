"""Union the yearly vacancy Parquet files into one dataset (idempotent).

Usage: py -I scripts/prepare_vacancies.py [--src-dir DIR] [--out-dir data]

Steps
1. Link originals into <out-dir>/original (os.link hard link, fallback shutil.copy2).
   Byte-identical files (sha256) are skipped; only the first copy is linked and used.
2. Union all years, keep all original columns/values, snake_case column names
   (mapping -> metadata/vacancies_column_mapping.csv), add source_file, source_year,
   source_row (0-based row index inside the source file).
3. Duplicate flags, nothing is removed:
   - is_duplicate: vacancy_id seen earlier (ordered by source_year, source_row);
     falls back to title+company+date+description hash if no ID column.
   - is_content_duplicate: same title+company+date_posted+description as an earlier row
     (different vacancy_id). Informational.
4. Write processed/vacancies.parquet (zstd) and processed/vacancies.csv (UTF-8, header,
   ISO 8601 dates, nulls as empty). Nested columns would be JSON-encoded in CSV.
"""
import argparse
import csv
import glob
import hashlib
import os
import re
import shutil
from pathlib import Path

import duckdb
import pyarrow.parquet as pq

ID_CANDIDATES = ("vacancy_id", "id", "job_id", "posting_id")


def sha256(path, buf=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(buf):
            h.update(chunk)
    return h.hexdigest()


def snake(name):
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name.strip())
    s = re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()
    return s or "col"


def q(s):
    return '"' + s.replace('"', '""') + '"'


def link_original(src, dst_dir):
    dst = dst_dir / src.name
    if dst.exists():
        if os.path.samefile(src, dst) or (dst.stat().st_size == src.stat().st_size
                                          and sha256(dst) == sha256(src)):
            return dst, "exists"
        dst.unlink()
    try:
        os.link(src, dst)
        how = "hardlink"
    except OSError:
        shutil.copy2(src, dst)
        how = "copy"
    return dst, how


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src-dir", default=r"C:\Users\boton\Downloads")
    ap.add_argument("--out-dir", default="data")
    ap.add_argument("--no-csv", action="store_true")
    a = ap.parse_args()
    out = Path(a.out_dir)
    orig, proc, meta = out / "original", out / "processed", out / "metadata"
    for d in (orig, proc, meta):
        d.mkdir(parents=True, exist_ok=True)

    srcs = sorted(Path(p) for p in glob.glob(os.path.join(a.src_dir, "vacancies_*.parquet")))
    if not srcs:
        raise SystemExit(f"no vacancies_*.parquet in {a.src_dir}")
    # prefer the canonical name (without "(n)") when byte-identical copies exist
    srcs.sort(key=lambda p: ("(" in p.name, p.name))
    used, seen = [], {}
    for p in srcs:
        h = sha256(p)
        if h in seen:
            print(f"{p.name}: IDENTICAL to {seen[h].name} -> excluded (not linked)")
            continue
        dst, how = link_original(p, orig)
        seen[h] = p
        m = re.search(r"(\d{4})", p.stem)
        used.append((dst, p.name, int(m.group(1)) if m else None))
        print(f"{p.name}: {how} -> {dst}")
    used.sort(key=lambda t: (t[2] or 0, t[1]))

    # schema check + mapping
    schemas = {n: pq.ParquetFile(d).schema_arrow for d, n, _ in used}
    first = next(iter(schemas.values()))
    for n, s in schemas.items():
        if [f.name for f in s] != [f.name for f in first]:
            print(f"WARNING: column set differs in {n}; union_by_name used, missing -> null")
    orig_cols = list(dict.fromkeys(f.name for s in schemas.values() for f in s))
    mapping = {}
    for c in orig_cols:
        base, k, new = snake(c), 1, snake(c)
        while new in mapping.values():
            k += 1
            new = f"{base}_{k}"
        mapping[c] = new
    with open(meta / "vacancies_column_mapping.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["original_column", "snake_case_column", "dtype"])
        for c in orig_cols:
            w.writerow([c, mapping[c], str(first.field(c).type) if c in first.names else ""])
        for c, t in (("source_file", "string"), ("source_year", "int16"), ("source_row", "int64"),
                     ("is_duplicate", "bool"), ("is_content_duplicate", "bool")):
            w.writerow(["(added)", c, t])

    con = duckdb.connect()
    con.execute("set threads to 4; set memory_limit='8GB'; set preserve_insertion_order=true")
    parts = []
    for d, name, yr in used:
        sel = ", ".join(f"{q(c)} as {q(mapping[c])}" for c in schemas[name].names)
        parts.append(f"select {sel}, '{name}' as source_file, {yr if yr else 'null'}::smallint as source_year, "
                     f"file_row_number as source_row from read_parquet('{d.as_posix()}', file_row_number=true)")
    con.execute("create temp view u as " + " union all by name ".join(parts))
    cols = [mapping[c] for c in orig_cols]
    idc = next((mapping[c] for c in orig_cols if mapping[c] in ID_CANDIDATES), None)
    content = [c for c in ("title", "company", "date_posted", "description") if c in cols]
    content_h = "hash(" + ", ".join(q(c) for c in content) + ")"
    key = q(idc) if idc else content_h
    order = "order by source_year, source_file, source_row"
    con.execute(f"""
        create temp table v as
        select {", ".join(q(c) for c in cols)}, source_file, source_year, source_row,
               row_number() over (partition by {key} {order}) > 1 as is_duplicate,
               row_number() over (partition by {content_h} {order}) > 1 as is_content_duplicate
        from u {order}""")

    pq_out = proc / "vacancies.parquet"
    tmp = pq_out.with_suffix(".parquet.tmp")
    con.execute(f"copy v to '{tmp.as_posix()}' (format parquet, compression zstd, row_group_size 100000)")
    os.replace(tmp, pq_out)

    # nested columns -> JSON in CSV; dates/timestamps -> ISO 8601 strings
    types = dict(con.execute("select column_name, column_type from (describe v)").fetchall())
    exprs = []
    for c, t in types.items():
        if any(x in t for x in ("[]", "STRUCT", "MAP")):
            exprs.append(f"to_json({q(c)})::varchar as {q(c)}")
        elif t == "DATE":
            exprs.append(f"strftime({q(c)}, '%Y-%m-%d') as {q(c)}")
        elif t.startswith("TIMESTAMP"):
            exprs.append(f"strftime({q(c)}, '%Y-%m-%dT%H:%M:%S') as {q(c)}")
        else:
            exprs.append(q(c))
    csv_out = proc / "vacancies.csv"
    if not a.no_csv:
        tmp = csv_out.with_suffix(".csv.tmp")
        con.execute(f"copy (select {', '.join(exprs)} from v) to '{tmp.as_posix()}' "
                    f"(header, delimiter ',', quote '\"', escape '\"', nullstr '')")
        os.replace(tmp, csv_out)

    # report
    tot, dup, cdup, ids = con.execute(
        f"select count(*), sum(is_duplicate::int), sum(is_content_duplicate::int), "
        f"count(distinct {key}) from v").fetchone()
    print(f"\nrows={tot:,} distinct_{'id' if idc else 'contenthash'}={ids:,} "
          f"is_duplicate={dup:,} is_content_duplicate={cdup:,}")
    for r in con.execute("select source_file, count(*), sum(is_duplicate::int), sum(is_content_duplicate::int), "
                         "min(date_posted), max(date_posted) from v group by 1 order by 1").fetchall():
        print("  ", r)
    print(f"{pq_out}: {pq_out.stat().st_size/1e6:,.1f} MB")
    if csv_out.exists():
        print(f"{csv_out}: {csv_out.stat().st_size/1e6:,.1f} MB")


if __name__ == "__main__":
    main()
