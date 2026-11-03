# Post-MVP: TechWolf models in the data pipeline

> Status: **not built**. This is the next step after the hackathon MVP. We started it, but
> stopped because of time. Nothing here is in the demo. The numbers marked *measured* come
> from a real run on 2026-11-03. Numbers marked *estimate* were not run.

## One slide

**Today (MVP):** the readiness score uses hardcoded market weights
(`MARKET_SHARE` in `src/backend/readiness.mjs`) and a mock bank (`mock/internal-bank.json`).
The scores are deterministic, but nobody can trace the market side back to real vacancies.

**Next:** use real labour-market evidence instead of hardcoded weights.

| Model | What it does for us | Output table |
|---|---|---|
| TechWolf **JobBERT-v3** | Maps every vacancy title to an ESCO occupation | `vacancy_occupation` |
| TechWolf **ConTeXT-Skill-Extraction** | Finds ESCO skills in each vacancy description | `vacancy_skill` |
| TypeSafe **Jev** | Gives each company an AI-readiness level, with probabilities | `company_ai_score` |

**Result:** every number in the dashboard links back to vacancies, ESCO codes and model
scores. A bank can see *"34% of comparable vacancies ask for model monitoring"* because
the pipeline counted it, not because we typed it in.

## Why this improves the workflow

| Step | Now (MVP) | With the models |
|---|---|---|
| Market demand for a skill | Hand-picked weight per skill | Share of postings that mention it, per year, sector and country |
| Job titles | Free text, 439,518 distinct variants | One ESCO occupation per title, with a similarity score |
| Competitor view | None | AI-readiness level per company, from public postings only |
| Internal vs market gap | 6 hand-chosen skills | All 13,485 ESCO skills, ranked by market demand |
| Adding new data | Edit code | Rerun the pipeline; embeddings are cached |
| Audit | "Trust us" | Every row has a score, the matching sentence and a `source` column |

For the analysis and RAG team, the three tables sit in one DuckDB file, keyed by
`vacancy_id`. A question like "which AI skills grew fastest at Dutch banks since 2023?"
becomes one SQL query, and the chatbot can quote the vacancy sentence it is based on.

## The data we have (measured)

- **1,542,169 vacancies**, 2021–2026, after the existing prep pipeline
  (`scripts/data_prep/run_pipeline.py`). 0 duplicate IDs; 145,608 content duplicates flagged.
  - 2021: 116,927 · 2022: 319,367 · 2023: 335,432 · 2024: 337,222 · 2025: 266,125 · 2026: 167,096 (to 26 Sep)
- Countries: GB 1,151,519 · NL 274,574 · LU 61,588 · BE 54,484.
- **439,518 distinct job titles** and 3,127 distinct company names.
- Descriptions: about 3,960 characters on average, 6.1 billion characters in total.
- ESCO skills: 13,485 in `data/external/skills.csv` (EN/NL/FR labels).
- ESCO occupations: **not collected yet.** `occupations.csv` is headers only. The ESCO API
  returned HTTP 500 on some pages in an earlier run.
- Hardware check: an RTX 5070 Laptop GPU (8 GB) runs both models with CUDA (torch 2.11, cu128).

## How the pipeline would work

```
vacancies_text.parquet
   ├─ distinct title_clean ──JobBERT-v3──► nearest ESCO occupation (top 3 + score) ──► vacancy_occupation
   ├─ description → sentences ──ConTeXT──► ESCO skill labels above threshold ──────► vacancy_skill
   └─ per company: counts and shares computed in code ──► Jev "score" question ───► company_ai_score
                                                                                       │
                                                         one DuckDB file under data/ ◄─┘
```

- **Titles → occupations:** embed the 439,518 distinct titles once, not the 1.5M rows. Keep
  the top 3 matches. Below a minimum similarity the match stays empty instead of guessing.
- **Descriptions → skills:** split into sentences and drop duplicate sentences, because the
  same company boilerplate repeats in thousands of postings. Keep a match only above a
  threshold that we pick by checking 200 matches by hand, and report that precision.
- **Company AI score:** the code computes the evidence (postings per year, share of AI
  skills, number of distinct skills). Jev only sees those numbers as plain text and returns
  probabilities for `none / exploring / piloting / scaling / embedded`. The code turns those
  into a 0–100 expected score. Raw answers are cached so reruns cost nothing.
- Embeddings are cached under `data/cache/`, so each step can be rerun and resumed.

## Effort and compute

| Step | Size | Effort (estimate) |
|---|---|---|
| Title mapping | 439,518 short titles | Minutes on the laptop GPU |
| Skill extraction, all vacancies | ~30 sentences per vacancy, ~45M sentences before dedup (estimate) | Hours on one GPU; a cloud GPU or a sample first |
| Skill extraction, sample | e.g. 50k vacancies, stratified by year and country | Under an hour |
| Jev scores | companies with at least 20 postings | One API call each, cached |
| Validation + manual precision check | 200 matches | About 1 hour of a person's time |

Sensible order: titles first (cheap, high value), then skills on a sample, then the full run
once the threshold and precision are known.

## Risks we flag up front

- **ConTeXT has no licence.** The model card on Hugging Face states none (checked
  2026-11-03, revision `039a634`). Outputs that depend on it are not cleared for product use
  until TechWolf confirms the terms. JobBERT-v3 is MIT (revision `5af78bb`).
- **Language:** ConTeXT is built on an English base model. About 25% of the vacancies are
  NL, LU or BE and may be Dutch or French, so skill recall there will be lower. JobBERT-v3 is
  multilingual.
- **Jev is an estimate, not a fact.** Every company score is labelled as an inference from
  public vacancies. We never claim a real company's AI spend, AI usage or headcount. We keep
  the raw probabilities for audit.
- **Vacancy data is licensed for the hackathon only.** Derived rows stay in `data/`
  (git-ignored) and are never pushed.
- **Two vacancy sources disagree.** `scripts/data_prep/` (main) covers 2021–2026. The
  `data/vacancy-duckdb` branch (`src/data/normalize_vacancies.py`) covers 2022–2026, cleans
  city names and uses its own `possible_duplicate` flag. Pick one before the full run.

## What it means for the pitch

- The MVP shows the **experience**: a readiness score with explanations.
- This step makes the score **evidence-based and scalable**: the same pipeline works for
  any company or sector in the vacancy data, with TechWolf's own models doing the matching.
- It fits TechWolf's skills-based approach: titles and skills on the ESCO standard, so
  internal job architectures can be compared with the market one-to-one.
