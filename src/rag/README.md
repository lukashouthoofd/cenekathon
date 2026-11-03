# RAG layer: vacancy vectors, ESCO skills, company data, search API

Two DuckDB files on the GPU VM (`ssh team19`, A100), served by `serve.py` (FastAPI) to the Claude agent as
7 tools (`tools.json`):

```
vacancies (DuckDB/CSV/Parquet) ─ build.py ──▶ rag.duckdb ─────┐
data/synthetic/*.csv ─────────── company.py ─▶ company.duckdb ─┴─ serve.py (127.0.0.1:8000) ─▶ agent
```

- **`rag.duckdb`** (market data): `postings` (exact duplicates collapsed, `n_copies`, `company_norm`,
  `title_norm`, `first_posted`), `posting_ids(vacancy_id, rep_id)` (source id -> dedup representative),
  `chunks(vacancy_id, chunk_idx, text, country, year, emb)`: <= 2,000-char chunks embedded with
  `BAAI/bge-m3` (1024-d) as header `title | company | city, country | YYYY-MM-DD` + chunk (`text` holds
  the chunk only; `country`, `year` are filter columns), `titles(title_norm, n_postings, emb)`
  (`TechWolf/JobBERT-v3`), `skills`, `posting_skills(vacancy_id, skill, score, evidence)` (ESCO skills
  per sentence via `TechWolf/ConTeXT-Skill-Extraction-base`, threshold 0.48). Only BE/NL/LU/GB rows are kept.
- **`company.duckdb`** (internal data, **SYNTHETIC**): the team's fictional Goldman Stanley CSVs from
  `origin/main:data/synthetic` (one table each, `is_synthetic` kept), plus `title_map` (JobBERT top 5
  market titles per internal `job_title`/`base_title`), `job_skill_esco` (`job_skills.skill_name` ->
  ESCO label: exact match, else ConTeXT cosine >= 0.8, else NULL) and `_meta(source, as_of)`.

## One command (from the laptop, Git Bash)

```bash
bash src/rag/run_build.sh <vacancies.duckdb|.csv|.parquet|vm:/path> [out_name]   # out_name default: rag
# env: API_PORT=8000  SESSION=live  CODE_DIR=~/rag_live   (quote "~/..." or use an absolute path)
ssh team19 tmux attach -t live      # watch (detach: Ctrl-b d)
```

It uploads the source to `~/rag_src/` (unless `vm:`), copies the code and the synthetic CSVs from
`origin/main` to `CODE_DIR`, and runs in tmux: `build.py` (source SQL picked by extension: `.duckdb` reads
`src.vacancies`) -> `company.py` -> only on success it stops whatever listens on `API_PORT` and starts
`uvicorn serve:app` with `RAG_DB`/`COMPANY_DB` set. It refuses to reuse a running tmux session or the
`~/rag` / `~/rag_wf` code dirs. For CSVs that need special parsing, build manually.

## Manual build (on the VM)

The source must return `vacancy_id, title, description, company, date_posted, country, city`.
Stages `dedup,embed,titles,skills` (rerun any with `--stages`); run long builds in tmux.

```bash
# team DuckDB (src/data/vacancies.duckdb, table vacancies; attached read-only as `src`)
python3 build.py --out rag.duckdb --source-db vacancies.duckdb --years 2022-2026

# CSV (team CSV chunks need the explicit options)
python3 build.py --out rag.duckdb --source-sql "SELECT vacancy_id::VARCHAR AS vacancy_id, title, description,
  company, date_posted::DATE AS date_posted, country, city
  FROM read_csv('vac_*.csv', quote='\"', escape='\"', header=true, all_varchar=true, max_line_size=20000000)"

# raw Parquet (default when no --source-db/--source-sql; --limit = random sample for testing)
python3 build.py --out sample.duckdb --limit 3000

# DuckDB + scraped CSV without ids
python3 build.py --out rag.duckdb --source-db vacancies.duckdb --source-sql "
  SELECT vacancy_id::VARCHAR AS vacancy_id, title, description, company, date_posted::DATE AS date_posted, country, city FROM src.vacancies
  UNION ALL
  SELECT 'scraped:' || md5(url), title, description, company, date_posted::DATE, country, city FROM read_csv('scraped.csv')"

# company data
python3 company.py --synthetic-dir synthetic --rag-db rag.duckdb --out company.duckdb
```

Sentences in more than 20 postings (`--max-sentence-postings`) are skipped as boilerplate.

**Speed (A100):** ~570 chunks/s embedding, skills ~2-3k sentences/s. 2025-2026 (433k rows -> 393k unique,
1.25M chunks) took 42 min to embed. Full 2022-2026: estimate ~3-4 h total.

## Serve

```bash
ssh -N -L 8100:localhost:8000 team19     # 8100 locally: the team backend already uses 8000
curl localhost:8100/health               # agent base URL: http://localhost:8100
ssh team19 'bash ~/rag_live/smoke_test.sh 8000'   # calls every endpoint of the running API (no restart)
```

The API binds to localhost only (confidential data). Don't expose it. Forward each tool call to
`POST http://localhost:8100/<name>`; the last 3 need `COMPANY_DB`.

| Tool | Returns |
|---|---|
| `search_postings` | best chunk per posting + vacancy_id/metadata for a query (filters: country, company, years): evidence to cite |
| `top_skills` | ESCO skill counts + share of filtered postings: market benchmarks |
| `similar_titles` | closest market job titles for any title (JobBERT) |
| `extract_skills` | ESCO skills + evidence sentence for free text, same model/threshold as the postings |
| `company_sql` | one read-only SELECT over the synthetic company tables (max 200 rows) |
| `company_profile` | headcount, AI usage/cost, AI-course completion, recruiting for the bank or one function |
| `skill_gap` | market_share - internal_share per skill for a function or job title, with example vacancy |

## Caveats

- ConTeXT is English-trained: weaker on NL/FR postings.
- Generic soft skills ("communication", "work in teams") rank high everywhere: compare **shares between
  segments**, not raw counts.
- Company data is **SYNTHETIC** (fictional Goldman Stanley): label it so in UI and pitch, never as a benchmark.
- Internal skill shares come from job-level skills (job architecture), so per job they are often 0 or 1.
