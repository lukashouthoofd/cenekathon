---
name: repo-polish
description: Use before the pitches or submission — make the README and repo scannable by judges in 60 seconds.
---

# Repo polish

README, top to bottom: one-line pitch · screenshot/GIF · live demo URL · the problem · how it works (diagram) · tech stack · run it locally (copy-paste commands that work) · team. Everything before "Run it" fits on one screen.

- Remove dead code and `console.log` noise; no secrets (`git grep`); `.env.example` complete.
- Readable commit messages; `main` runs from a fresh clone.
- `LICENSE` present (MIT). Set repo description + topics: `gh repo edit --description "..." --add-topic hackathon`.
- Link the demo recording. Don't claim features that are mocked.
