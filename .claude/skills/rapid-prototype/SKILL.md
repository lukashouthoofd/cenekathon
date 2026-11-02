---
name: rapid-prototype
description: Use when building the product under time pressure — walking skeleton, thin vertical slices, mock-then-real, and keeping main demoable.
---

# Rapid prototype

- **Walking skeleton:** one input → one real processing step → one visible output, deployed. Do this before any feature.
- **Vertical slice = user-visible.** Each slice ends with something you can click or run in the demo. No "backend done, frontend later".
- **Mock → real:** stub external or slow parts with clearly labelled fixtures (`MOCK` in the UI); wire the real thing after the slice works. Never present mocks as real.
- **Boring tech.** Use what the team already knows. E.g. Next.js/Vite + a serverless function, or FastAPI + a simple page. SQLite / JSON file / Supabase over self-run Postgres. One repo, one deploy.
- **Hardcode first,** generalize only if the demo needs it. No auth unless the brief demands it (use a fake user switch).
- **Seed data:** commit a fixture so the demo works offline and after a fresh clone.
- **Happy-path polish > edge cases.** The demo path must be flawless; everything else may fail gracefully.
- **Timebox:** a slice not working after 45 min → cut scope, don't push on.
- Commit + push after every working step. `main` must always run.

**Done when:** the slice runs from a clean clone with the documented command and shows its result.
