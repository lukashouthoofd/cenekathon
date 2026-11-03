"""Normalize the yearly vacancy parquet files (2022-2026) into one dataset.

Rerun with:  py -3 normalize_vacancies.py
Put the raw vacancies_<year>.parquet files in IN_DIR (raw/ next to this script). They are read only.
Outputs are written to OUT_DIR (same folder as this script).
Prints a JSON statistics summary to stdout, which feeds normalization_report.md.
"""
import json
import re
import pathlib

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.parquet as pq

OUT_DIR = pathlib.Path(__file__).resolve().parent
IN_DIR = OUT_DIR / "raw"
YEARS = [2022, 2023, 2024, 2025, 2026]  # explicit list: 2021 files exist but are out of scope
OUT_PARQUET = OUT_DIR / "vacancies_normalized.parquet"
OUT_CSV = OUT_DIR / "vacancies_normalized.csv"

EXPECTED_COLUMNS = ["vacancy_id", "title", "description", "company", "date_posted", "country", "city"]

# Target schema. city_raw keeps the original label so every city change is auditable.
TARGET_SCHEMA = pa.schema([
    ("vacancy_id", pa.string()),
    ("title", pa.string()),
    ("company", pa.string()),
    ("description", pa.string()),
    ("date_posted", pa.date32()),
    ("country", pa.string()),
    ("city", pa.string()),
    ("city_raw", pa.string()),
    ("source_year", pa.int32()),
    ("source_file", pa.string()),
    ("possible_duplicate", pa.bool_()),
])

# Labels that name a country or region rather than a locality. Their city becomes null.
COUNTRY_ONLY = {
    "uk", "united kingdom", "gb", "great britain", "england", "scotland", "wales",
    "northern ireland", "nederland", "netherlands", "belgium", "belgique", "belgie",
    "belgica",
}
# Explicit spelling/name variants of the same locality (casefolded key -> canonical).
ALIASES = {
    "luxemburg city": "Luxembourg",
    "luxembourg city": "Luxembourg",
    "city of edinburgh": "Edinburgh",
    "den haag": "The Hague",
    "bruxelles": "Brussels",
}


def clean_ws(text):
    return re.sub(r"\s+", " ", text).strip()


def base_city(raw):
    """First comma-separated segment of the raw label, with country-only labels set to None.

    'London, England, United Kingdom' -> 'London'; 'United Kingdom' -> None.
    """
    if raw is None or (isinstance(raw, float) and np.isnan(raw)):
        return None
    first = clean_ws(raw).split(",")[0].strip()
    if not first:
        return None
    low = first.casefold()
    if low in COUNTRY_ONLY or re.fullmatch(r"belgi.{0,2}", low):  # also catches a mojibake 'Belgi\ufffd'
        return None
    if low in ALIASES:
        first = ALIASES[low]
    return first


def build_canonical(base_values):
    """Map each casefolded city key to one display spelling.

    Prefers the most frequent mixed-case spelling; if only all-lower or all-upper forms exist, uses str.title().
    """
    counts = base_values.dropna().value_counts()
    groups = {}
    for form, n in counts.items():
        groups.setdefault(form.casefold(), []).append((form, int(n)))
    canon = {}
    for forms in groups.values():
        mixed = [(f, n) for f, n in forms if not f.islower() and not f.isupper()]
        pool = mixed if mixed else forms
        best = max(pool, key=lambda x: x[1])[0]
        if not mixed:
            best = best.title()
        for f, _ in forms:
            canon[f] = best
    return canon


def trim_series(s):
    return s.astype("string").str.strip()


def load_small(year):
    """Columns needed for dedup and label mapping, plus a 64-bit hash of description."""
    path = IN_DIR / f"vacancies_{year}.parquet"
    t = pq.read_table(path)
    if t.column_names != EXPECTED_COLUMNS:
        raise SystemExit(f"Unexpected schema in {path.name}: {t.column_names}")
    desc = t.column("description").to_pandas()
    df = t.drop(["description"]).to_pandas()
    for col in ["vacancy_id", "title", "company", "country"]:
        df[col] = trim_series(df[col]).replace("", None)
    df["country"] = df["country"].str.upper()
    df["date_posted"] = pd.to_datetime(df["date_posted"]).dt.date
    df["city_raw"] = t.column("city").to_pandas().astype("string")
    df["city_base"] = [base_city(x) for x in df["city_raw"].tolist()]
    df["desc_hash"] = pd.util.hash_pandas_object(desc.astype("string"), index=False).to_numpy()
    df["source_year"] = year
    df["source_file"] = path.name
    return df


def main():
    stats = {"files": {}, "totals": {}}

    # Pass 1: small columns only, to find cross-file duplicates and the global city spelling map.
    parts = [load_small(y) for y in YEARS]
    all_small = pd.concat(parts, ignore_index=True)
    canon = build_canonical(all_small["city_base"])
    all_small["city"] = all_small["city_base"].map(lambda v: canon.get(v) if v is not None else None)

    # Exact duplicate vacancy_id across the whole set: keep first occurrence, count the removals.
    dup_id = all_small["vacancy_id"].duplicated(keep="first").to_numpy()
    all_small["removed_dup_id"] = dup_id
    kept = all_small.loc[~dup_id].copy()

    # Content duplicate flag (different vacancy_id, same title/company/country/city/date/description).
    content_key = (
        kept["title"].fillna("") + "|" + kept["company"].fillna("") + "|" + kept["country"].fillna("")
        + "|" + kept["city"].fillna("") + "|" + kept["date_posted"].astype("string").fillna("")
        + "|" + kept["desc_hash"].astype(str)
    )
    flag_series = pd.Series(content_key.duplicated(keep=False).to_numpy(), index=kept.index)
    all_small["possible_duplicate"] = False
    all_small.loc[kept.index, "possible_duplicate"] = flag_series.to_numpy()

    # Pass 2: write the output, file by file, to keep memory bounded.
    writer = pq.ParquetWriter(OUT_PARQUET, TARGET_SCHEMA, compression="zstd")
    csv_writer = pacsv.CSVWriter(OUT_CSV, TARGET_SCHEMA)
    offset = 0
    for year in YEARS:
        path = IN_DIR / f"vacancies_{year}.parquet"
        t = pq.read_table(path)
        n_in = t.num_rows
        seg = all_small.iloc[offset:offset + n_in]
        offset += n_in
        assert (seg["source_file"] == path.name).all()

        df = t.to_pandas()
        for col in ["vacancy_id", "title", "company", "description", "country"]:
            df[col] = df[col].astype("string").str.strip().replace("", None)
        df["country"] = df["country"].str.upper()
        df["date_posted"] = pd.to_datetime(df["date_posted"]).dt.date
        df["city_raw"] = df["city"].astype("string")
        df["city"] = seg["city"].to_numpy()
        df["source_year"] = np.int32(year)
        df["source_file"] = path.name
        df["possible_duplicate"] = seg["possible_duplicate"].to_numpy(dtype=bool)
        keep = ~seg["removed_dup_id"].to_numpy(dtype=bool)

        out = df.loc[keep, [f.name for f in TARGET_SCHEMA]]
        table = pa.Table.from_pandas(out, schema=TARGET_SCHEMA, preserve_index=False)
        writer.write_table(table)
        csv_writer.write_table(table)

        year_mismatch = int((pd.to_datetime(out["date_posted"]).dt.year != year).sum())
        stats["files"][str(year)] = {
            "rows_before": int(n_in),
            "removed_duplicate_vacancy_id": int((~keep).sum()),
            "rows_after": int(keep.sum()),
            "date_min": str(min(out["date_posted"])) if len(out) else None,
            "date_max": str(max(out["date_posted"])) if len(out) else None,
            "date_year_not_equal_source_year": year_mismatch,
            "city_raw_non_null": int(df["city_raw"].notna().sum()),
            "city_null_after": int(out["city"].isna().sum()),
            "city_changed": int((out["city"].fillna("") != out["city_raw"].fillna("")).sum()),
            "possible_duplicate_true": int(out["possible_duplicate"].sum()),
        }
        del t, df, out, table
    writer.close()
    csv_writer.close()

    # Verification: re-read the parquet output.
    meta = pq.ParquetFile(OUT_PARQUET).metadata
    stats["totals"]["rows_before"] = int(sum(v["rows_before"] for v in stats["files"].values()))
    stats["totals"]["removed_duplicate_vacancy_id"] = int(sum(v["removed_duplicate_vacancy_id"] for v in stats["files"].values()))
    stats["totals"]["rows_after"] = int(meta.num_rows)
    stats["totals"]["possible_duplicate_true"] = int(sum(v["possible_duplicate_true"] for v in stats["files"].values()))
    stats["totals"]["output_parquet_bytes"] = OUT_PARQUET.stat().st_size
    stats["totals"]["output_csv_bytes"] = OUT_CSV.stat().st_size
    stats["city_mapping_distinct_base"] = int(all_small["city_base"].nunique())
    stats["city_mapping_distinct_canonical"] = int(pd.Series(list(canon.values())).nunique()) if canon else 0
    stats["city_null_count_total"] = int(all_small["city"].isna().sum())
    print(json.dumps(stats, indent=2, default=str))


if __name__ == "__main__":
    main()
