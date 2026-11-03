# Data: CenEkathon 2026 vacancy dataset

> **Confidential.** Use only for the CenEkathon, never share outside the team. This repo is
> public: **never commit, upload, paste or deploy the raw files or large excerpts.** `data/` is
> git-ignored (and `data/.gitignore` ignores everything inside it).

## Where it is

```
data/vacancies_2021.parquet   ~131 MB   116,927 rows
data/vacancies_2022.parquet   ~438 MB   319,367 rows
data/vacancies_2023.parquet   ~497 MB   335,432 rows
data/vacancies_2024.parquet   ~420 MB   337,222 rows
data/vacancies_2025.parquet   ~290 MB   266,125 rows
data/vacancies_2026.parquet   ~253 MB   167,096 rows (to 26 Sep)
```

`data/` sits at the root of the main checkout (`C:\Users\lukas\cenekathon-starter\data`).
Agent worktrees under `.claude/worktrees/<name>/` don't have it by default. Read it via
`../../../data/` or create a junction:
`cmd /c mklink /J data C:\Users\lukas\cenekathon-starter\data`.
Teammates on other machines download the files with the links from the organisers
(they expire Tue 3 Nov 2026 23:59 Brussels) into their own `data/`.

## What it is

1,542,169 real job postings from banks, insurers, payment firms and other financial companies in
BE, NL, LU and GB (plus agency/job-board postings for them), posted Jan 2021 – Sep 2026,
collected by TechWolf from public job sites. One Parquet file per posting year.

| Column | What it is |
| :- | :- |
| `vacancy_id` | unique id of the posting in this dataset |
| `title` | job title as posted |
| `description` | full posting text as posted (HTML and formatting may remain) |
| `company` | name of the organisation that published the posting, as written on the job site |
| `date_posted` | date the posting went online (empty for 271 postings from 2021) |
| `country` | `BE`, `NL`, `LU` or `GB` |
| `city` | city or locality, as given by the job site |

- Multilingual, mostly English (about ¾ are UK postings).
- **No labels, categories or skill tags.** Anything beyond the raw posting is up to us.
- **Collection was incomplete Jan–Apr 2026.** A dip in those months reflects the collection, not hiring.
- `company` can be a recruitment agency or job board, not the actual employer.

## Reading it

Query all years at once without loading them into memory (DuckDB):

```python
import duckdb
duckdb.sql("""
  SELECT country, year(date_posted) AS y, count(*) AS n
  FROM 'data/vacancies_*.parquet' GROUP BY ALL ORDER BY ALL
""").show()
```

```python
import pandas as pd
df = pd.read_parquet("data/vacancies_2024.parquet", columns=["title", "company", "country"])
```

Files are large (~2 GB total). Select only the columns you need, and avoid loading `description`
for all years into pandas at once.
