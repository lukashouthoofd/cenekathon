# Goldman Stanley (synthetic): internal HR & AI-usage dataset

**EVERYTHING IN THIS FOLDER IS SYNTHETIC.** "Goldman Stanley" is a fictional company. No row describes a real
company, a real employee or real AI spend. Do not present any figure from here as real, as an industry
benchmark, or as data about any named bank. Every file has an `is_synthetic=true` column.

The data stands in for what a bank would hold internally (hackathon rule: synthetic data is allowed only for a
company's own internal data). It contains no data about competitors and no personal data. Employees are
pseudonymous IDs (`EMP000123`) with job, department, location, grade, FTE and hire/exit dates only.

## How it is generated
Script: `scripts/generate_synthetic_data.py`. It uses a fixed seed (`SEED = 20260901`, numpy + stdlib random),
is deterministic and re-runnable, and takes about 10 s (`py -I scripts/generate_synthetic_data.py`).
Period: 2023-01-01 to 2026-09-30.

Grounding in public data. These are the only real inputs:
- **Job titles:** the most frequent normalised vacancy titles (`title_clean`, with seniority prefixes removed)
  at banking employers in GB/NL/BE/LU, taken from `data/processed/vacancies_text.parquet`. A title is kept only
  if it appears at 5 or more distinct companies. Keyword rules assign each title to a bank function. The vacancy
  count is kept as `source_vacancy_count`. No company names are carried over.
- **ESCO / ISCO:** `esco_uri` and `isco08_code` (the first 4 digits of the ESCO occupation code) are filled only
  when a keyword hint resolves to an ESCO occupation label that exists in the local ESCO extract
  (`data/external/raw/esco/occupation_*.json.gz`). That extract is partial, so many jobs are left blank on purpose.
  `skill_uri` comes from exact or alternative label matches in `data/external/skills.csv`. Non-ESCO skills
  (mostly the new AI skills) have an empty URI. No codes were invented.

Simulation logic (all invented):
- **Organisation:** Group, then 6 divisions, then 18 functions (`FN_*`), then country teams (`T_<fn>_<country>`)
  in GB/NL/BE/LU. About 7,900 employees on payroll at any time.
- **Workforce:** a monthly stock-flow model per team. Exits follow a monthly attrition rate per function, with
  seasonal peaks in January and September. Hires fill the gap to a target headcount. The target trends from 2024:
  Contact Centre -18%, Branch -12%, Operations -10%, Data/AI +40%, Software +15%, Cyber +20%.
  `headcount_monthly` is computed from `employees` at each month end, so the two files are consistent by construction.
- **AI usage:** daily aggregates per team, tool, model and use case. Adoption follows a logistic curve per
  function with a different cap and midpoint: Tech/Data are highest and earliest, Contact Centre and Ops high,
  Legal, Audit and Risk moderate and later. The chat assistant had a tech-only pilot in 2023 and was rolled out to
  everyone from 2023-09. The coding assistant is for tech functions only. API pipelines (call summarisation,
  document extraction, KYC screening, RAG) start in 2024. Tokens per request grow over time (longer context,
  agentic coding). Cost = tokens x approximate public list price (`model_pricing.csv`, USD converted at 0.92 EUR)
  x (1 - enterprise discount, which rises from 0% to 25%). Newer and cheaper models gain share over time, so the
  effective EUR per 1M tokens falls sharply. Prices are approximate and only for illustration.
  `llama-3.1-70b-selfhosted` uses an invented internal cost.
- **Learning:** annual mandatory courses (AML, GDPR, Code of Conduct, plus AI Literacy from 2025, modelled on the
  EU AI Act Art. 4). Function-specific electives become more likely to be AI courses over time.
- **Recruiting:** requisitions are derived from the simulated hires (`sum(hires)` = hires in `employees` from
  2023 onward). Frontline L1 requisitions fill up to 6 seats. Extra open, cancelled and on-hold requisitions are
  added. There is no candidate-level data.

## Files and join keys
| file | grain | keys |
|---|---|---|
| departments.csv | org unit (`org_level` 0-3) | `department_id`, `parent` -> `department_id` |
| job_architecture.csv | job (base title x level L1-L5) | `job_id`; `department_id` = function (`FN_*`) |
| job_skills.csv | job x skill | `job_id`; `skill_uri` (ESCO, optional) |
| employees.csv | employee | `employee_id`, `job_id`, `department_id` = team (`T_*`) |
| headcount_monthly.csv | month x team x job x country | `department_id` (team), `job_id` |
| ai_usage_logs.csv | day x team x tool x model x use case | `department_id` (team), `function_code`, `model` -> model_pricing |
| model_pricing.csv | model x price period | `model` |
| courses.csv | course | `course_id`, `skill_name` |
| learning_records.csv | enrolment | `employee_id`, `course_id` |
| recruiting_records.csv | requisition | `job_id`, `department_id` (team) |

To get from a team to its function: `departments.parent`, or `job_architecture.department_id` for a job.

## Caveats
- The data has no internal job moves or promotions: an employee keeps one job and team for their whole tenure.
- AI `active_users` counts unique daily users per row. Summing across rows double-counts people who use several
  tools or models. For API rows, it means end users of the API-backed application.
- The trends are designed narratives, not estimates. Never use them as evidence about the real labour market.
