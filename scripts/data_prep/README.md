# Data preparation pipeline

Python scripts that turn the hackathon vacancy Parquet files into DuckDB-ready files and collect
the external datasets. Run them from the repo root. The vacancy data is licensed for the hackathon
only, so its outputs land in `data/`, which is git-ignored, and are never committed.

```bash
py -I scripts/data_prep/run_pipeline.py --src-dir <folder with vacancies_*.parquet>
```

| script | what it does |
|---|---|
| `inspect_parquet.py` | inventory of the Parquet files (schema, nulls, duplicates, date ranges) -> `data/metadata/` |
| `prepare_vacancies.py` | unions all years into `data/processed/vacancies.parquet` + `.csv`, adds `source_file`, `source_row`, `is_duplicate`, `is_content_duplicate` |
| `prepare_text_export.py` | HTML-stripped text copy for RAG -> `data/processed/vacancies_text.parquet` |
| `export_csv_chunks.py` | splits the clean text into CSVs < 95 MB -> `data/processed/vacancies_clean_csv/` |
| `collect_external_data.py` | ESCO skills/occupations, GLEIF, Eurostat, ONS, ILO / Felten / GPTs-are-GPTs / Anthropic AI exposure, Jev company labels -> `data/external/` (needs `TYPESAFE_API_KEY` in `.env` for Jev; `--no-jev` to skip) |
| `generate_synthetic_data.py` | synthetic internal data for the fictional "Goldman Stanley" -> `data/synthetic/` (committed; see its README) |
| `validate_data.py` | row counts, missing values, duplicates, source coverage -> `data/metadata/validation_report.md` |

Load the cleaned CSV chunks in DuckDB with explicit options (the auto-sniffer trips on long multi-line descriptions):

```sql
SELECT * FROM read_csv('data/processed/vacancies_clean_csv/*.csv', quote='"', escape='"',
                       header=true, all_varchar=true, max_line_size=20000000);
```
