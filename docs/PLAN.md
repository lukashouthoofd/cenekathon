# Plan

> Produced by the `kickoff` skill. Update at every sync beat.
> Facts below are taken from the code (src/backend, src/frontend/src). Items marked TBD are not in the code.

- **Idea (one line):** An AI-readiness assistant for financial companies: vacancy trends plus company data give a readiness view, and a chat answers with evidence and gives one piece of advice.
- **User & pain:** TBD (not defined in the code).
- **Wow moment (the demo's peak):** TBD.
- **Architecture (≤ 3 components, ASCII flow):**

```
+-----------------------+       POST /api/chat        +----------------------------+
| Frontend (React/Vite) | --------------------------> | Chat backend (Node, no deps)|
| demo fixtures OR API  | <-------------------------- | src/backend/chat.mjs       |
+-----------------------+   {message, mode}           +--------------+-------------+
                                                                      |
                                              Anthropic API (server-side AI_API_KEY)
                                                                      |
                                              reads summary.json (numbers only)
                                                                      ^
                                              +-----------------------+-----------+
                                              | Data summary (Python + DuckDB)    |
                                              | src/backend/build_summary.py      |
                                              | input: data/vacancies_*.parquet   |
                                              | run offline, once                 |
                                              +-----------------------------------+
```

## Contracts

### (a) Chat: POST /api/chat

Request (`ChatRequest` in `src/frontend/src/types.ts`):

```json
{ "messages": [ { "role": "user" | "assistant", "content": "..." } ] }
```

Backend validation (`validMessages` in `chat.mjs`): 1 to 30 messages, `content` a non-empty string up to 4000 characters.

Response (`ChatResponse`):

```json
{
  "message": {
    "role": "assistant",
    "content": "...",
    "dashboard": { "title": "...", "widgets": [ ... ] }
  },
  "mode": "live"
}
```

`dashboard` is optional. `mode` is `'live' | 'demo'` in the frontend type; the backend always returns `'live'`. Only the frontend demo mode returns `'demo'`.

Dashboard widgets (kept only if well-formed by `validWidget` in `chat.mjs`; invalid widgets are dropped):

- Metric: `{ "type": "metric", "label": string, "value": string, "note"?: string }`
- Bar: `{ "type": "bar", "title": string, "unit"?: string, "items": [ { "label": string, "value": number } ] }`

No other widget types exist in the backend or the frontend type (`DashboardWidget`).

Reply parsing (`parseReply`): the last ```json block in the model reply is parsed for `{"dashboard": ...}`. If it is missing or invalid, the whole reply is shown as plain text.

Errors: 400 invalid messages; 500 when `AI_API_KEY` is missing; 504 on a 30 s timeout; 502 for other upstream errors. Also `GET /api/health` returns `{ ok, model, summary }`.

### (b) summary.json (written by `build_summary.py` to `data/summary.json`)

Top-level keys, in order of the script:

- `total_postings`
- `per_year`
- `per_country`
- `per_year_country`
- `top_companies` (list of `{company, postings}`, top 15)
- `company_names` (`distinct_raw_names`, `distinct_canonical_names`, `raw_names_collapsed`)
- `duplicates_removed`
- `skill_keyword_postings_per_year`
- `skill_keyword_share_of_postings_per_year`
- `notes` (list of strings)

The script exits with an error instead of writing if its sanity checks fail.

### (c) Frontend readiness endpoints (src/frontend/src/api.ts)

Not yet implemented by backend. The backend's `handle()` in `chat.mjs` only routes `/api/health` and `/api/chat`; every other path returns 404.

- `GET /api/companies` returns `{ companies: Company[] }`: not yet implemented by backend.
- `GET /api/companies/{id}/readiness` returns `Readiness`: not yet implemented by backend.
- `POST /api/analyze` with `{ companyId, question? }` returns `AnalyzeResponse`: not yet implemented by backend.
- `POST /api/slack/preview` with `{ companyId, actionId }` returns `{ text }`: not yet implemented by backend.

In demo mode (`VITE_DEMO_MODE=true`) these calls return fixtures and make no request.

## Not doing

- Slack bot. BLOCKED: needs Slack app tokens from the team. Only a preview exists in the frontend (`SlackPreviewDialog.tsx`, `getSlackPreview`).
- User accounts and login.
- Mobile app.
- Live scraping of vacancy sites.
- Real readiness endpoints on real data. The dashboard is demo-only (frontend fixtures).
- Public Vercel deploy of vacancy aggregates. Pending licence decision with the team.

## Data honesty

- Vacancy data is licensed, for team use only. It is not in the repo: `data/` is git-ignored, and so is `src/backend/summary.json`.
- `summary.json` is derived from that data and is also git-ignored.
- Skill figures are keyword counts (regex on title and description), not verified skills. The summary notes say so; the chat prompt tells the model to say so.
- The postings are mostly English (about three quarters UK), and data collection was incomplete from January to April 2026 (both from `notes` in `build_summary.py`).
- Duplicates (same title, company, date_posted and country) are removed before counting.
- Demo mode uses simulated data and is labelled as such.
- The "Advies:" line is requested by the chat prompt only. `parseReply` does not check for it.

## Open decisions

See `docs/DECISIONS.md`. Open items there: whether the signed-link docx stays in git history, and the licence decision for a public Vercel deploy of aggregates.

## Slices

| # | Slice (user-visible) | Owner | Status |
|---|----------------------|-------|--------|
| 1 | Walking skeleton, deployed | | TBD |

## Cut line (drop first if behind at 17:30)

TBD.

## Demo story (30 seconds)

TBD.
