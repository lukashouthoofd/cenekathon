# Decisions

One entry per decision. Newest first. Times not recorded for these entries. "None recorded" means no alternative is written down in the code or docs.

## 2026-11-03 — Example bank named "Goldman Stanley (gesimuleerd)"
- **Decision:** The example bank is called "Goldman Stanley (gesimuleerd)". Its data is fictional internal data and is labelled simulated everywhere it appears.
- **Why:** The name resembles real banks, so the "gesimuleerd" label must stay on every screen and in every export.
- **Alternatives rejected:** None recorded.

## 2026-11-03 — Vercel deploy stays off
- **Decision:** The app is not deployed to Vercel and runs local-only. The owner answered "Nee, alleen lokaal".
- **Why:** The vacancy-data aggregates are licensed for team use only, and a public deploy would put them outside the team.
- **Alternatives rejected:** Public Vercel deploy, rejected by the owner.

## 2026-11-03 — TechWolf Hugging Face models not adopted now
- **Decision:** The TechWolf models on Hugging Face are not adopted for now. JobBERT-v3 is a job-title embedder, Dutch is not listed on its model card, and no evaluation numbers are given.
- **Why:** There is no evidence the model works for Dutch vacancy data.
- **Alternatives rejected:** Adopting JobBERT-v3 now. Revisit only for job-title matching, on a GPU, with a labelled test set.

## 2026-11-03 — Follow-up suggestions are deterministic
- **Decision:** Follow-up suggestions are generated deterministically, with no extra AI call. The demo fixture carries them too.
- **Why:** No extra model call per answer, and the demo shows the same kind of suggestions as the live app.
- **Alternatives rejected:** None recorded.

## 2026-11-03 — Google-style evidence panel restored next to skill gaps
- **Decision:** The evidence panel sits next to the skill gaps, in the Google-style layout from the original brief.
- **Why:** Restores the layout asked for in the original brief.
- **Alternatives rejected:** None recorded.

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
