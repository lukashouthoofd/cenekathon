---
name: demo-and-pitch
description: Use in the last 90 minutes (from about 17:30) — freeze scope, script the demo, build the slides, rehearse the pitch for the 19:00 pitch block.
---

# Demo & pitch

**17:30 feature freeze.** Only bugfixes and demo polish after this. Apply the cut line from `docs/PLAN.md`.

**Demo script (`docs/PITCH.md`)** — one happy path, ≤ 2 min, rehearsed 3×:
1. Hook: one sentence on the person with the pain (a story, not a statistic).
2. Show the magic moment live (fallback: recording).
3. One line on how it works (architecture picture, ≤ 3 boxes).
4. Honest status: what's real, what's mocked.
5. Why it scales / what's next (3 bullets from `deploy-fast`).
6. Closing line / ask.

**Slides (max 5):** Problem · Solution + demo · How it works (tech + AI) · Impact / scale · Team + next. Big text, one idea per slide; a screenshot beats a bullet list.

**Rehearse:** time it on a phone. Assign a speaker and a driver (hands on keyboard). Pre-load demo state, silence notifications, have the deployed URL and local fallback ready.
**Q&A prep:** write 5 likely judge questions (tech choices, data, limits, business value, what if the model is wrong) with answers.
**Last check** against the judging criteria in `docs/CHALLENGE.md`.
