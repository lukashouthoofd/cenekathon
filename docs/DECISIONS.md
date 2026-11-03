# Decisions

One entry per decision. Newest first. Times not recorded for these entries. "None recorded" means no alternative is written down in the code or docs.

## 2026-11-03 — Frontend has no backend calls in demo mode
- **Decision:** With `VITE_DEMO_MODE=true`, every function in `src/frontend/src/api.ts` returns fixture data and makes no request.
- **Why:** The demo runs without a backend or API key, and the simulated data is labelled as such.
- **Alternatives rejected:** None recorded. (The readiness endpoints in `api.ts` are not implemented by the backend yet.)

## 2026-11-03 — Keep data/ and the derived summary out of git
- **Decision:** `data/` and `src/backend/summary.json` are in `.gitignore`.
- **Why:** The vacancy data is licensed for team use only, and the summary is derived from it.
- **Alternatives rejected:** None recorded.

## 2026-11-03 — Signed-link docx removed from the working tree (commit be37ccf)
- **Decision:** The docx with signed download links to licensed data and the 9 MB slide PDF were removed from git and git-ignored; the files stay on disk.
- **Why:** The docx contains signed links to licensed data, and both files were added by mistake in d090c02.
- **Alternatives rejected:** None recorded. OPEN: the docx is still in git history; whether to rewrite history is undecided.

## 2026-11-03 — Advice line required in dashboard answers
- **Decision:** The chat prompt requires every dashboard answer to end with one concrete "Advies:" line that cites a figure from the data.
- **Why:** From the TechWolf deck: a dashboard is not a solution.
- **Alternatives rejected:** None recorded. Note: `parseReply` does not enforce the line; it is a prompt instruction only.

## 2026-11-03 — SYSTEM prompt gives Claude only summary numbers, never raw rows
- **Decision:** The chat backend puts only `summary.json` into the system prompt; raw vacancy rows are never sent to Claude.
- **Why:** Keeps licensed raw data off the API and limits answers to aggregated figures.
- **Alternatives rejected:** None recorded.

## 2026-11-03 — Local Node chat backend with no dependencies
- **Decision:** The chat backend is plain Node (`chat.mjs`, with `server.mjs` locally and `api/chat.mjs` for Vercel) and calls the Anthropic API over `fetch`, with no npm dependencies.
- **Why:** Nothing to install for the demo, and the API key stays on the server.
- **Alternatives rejected:** None recorded.
