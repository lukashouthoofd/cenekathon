# 5-minute pitch: run order and script

> Slide numbers match `docs/pitch/index.html` (press → or Space to move on). Target: 4:50, which leaves about 10 seconds of buffer.
> Slides not in the run order are kept as backup for questions, see the end of this file.

## Run order

| # | Slide | Seconds | Say |
|---|---|---|---|
| 1 | Title | 10 | Who we are, and what Json does in one line. |
| 2 | Problem | 30 | Banks are racing into AI and do not know where they stand. Job postings show what competitors do, every day. |
| 4 | Solution | 35 | Json finds the skill gap, benchmarks it against peers, and routes it to train, tool or hire. |
| 5 | Three actions | 25 | Each gap gets one of three fixes. Each option shows its owner, its pilot and its success measure. |
| 8 | How it works | 25 | Five steps: vacancies and internal data, processing, two data stores, a Claude agent, and Slack hand-offs. |
| 11 | The app today | 20 | This is the real build, in demo mode. Scores with data coverage, gaps per department, and the action plan. |
| 12 | Showcase video | 60 | Play the video. Narrate only where it helps: the scores, the gaps, the plan. |
| 13 | Floorplan | 20 | The app is built from a few parts: a web app, an API, an analysis backend, and a data store. |
| 18 | Status & roadmap | 20 | Real in the demo, mocked or partial, and what comes next. Be explicit that Slack sends nothing yet. |
| 19 | Next step (post-MVP) | 20 | Not built, not in the demo. We would replace hardcoded weights with TechWolf's models on 1.34M deduplicated vacancies. |
| 20 | Team | 10 | Four students: two on data and analysis, two on the agent and the app. |
| 21 | What to do | 15 | Ends in advice, not a dashboard. Next: a pilot on one bank's real HR data. |

Total: 290 seconds.

## Before you present

- Slide 17 ("Measured, not just demoed") still has `[x]%` placeholders. It is not in the run order. Fill it in or keep it as backup.
- Slide 7 (the demo script) has `[bank]` placeholders. It is not in the run order.
- Headline number: 1.34M deduplicated vacancies (1,341,284 in `data/summary.json`). Slide 19 is the only slide that also mentions the raw count (1,542,169).
- Play the video from the slide, not from a separate window, so the timing holds.

## Backup for questions (not in the run order)

- 3 The question, 6 Hiring flow, 7 Demo script, 9 Data foundation, 10 Architecture
- 14 Live map (`https://frolicking-axolotl-1b189c.netlify.app/`), 15 Cost & scale, 16 Security & privacy, 17 Correctness
- 22–26 Appendix A1–A5, including A5 "Likely judge questions". Full answers are in `docs/pitch/QA.md`.
