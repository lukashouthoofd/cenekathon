---
name: smoke-testing
description: Use when you need confidence the demo path works — a few fast tests for the critical flow (unit tests for logic, a browser smoke test with Playwright, API checks with curl).
---

# Smoke testing (test the demo path, not everything)

Priority order — stop when the demo path is covered:
1. **Pure logic** (parsing, scoring, formatting): a handful of unit tests (`vitest` / `pytest`). Write the failing test first when fixing a bug.
2. **API:** `curl -s localhost:PORT/health` and one call per endpoint with a real payload; assert status + shape.
3. **Browser flow:** one Playwright test that opens the app, performs the demo steps, asserts the visible result.
   ```bash
   npm i -D @playwright/test && npx playwright install chromium
   npx playwright test            # tests/demo.spec.ts
   ```
   Or drive it manually with an agent browser tool and take a screenshot as evidence.
4. **AI paths:** test with the 5 saved fixtures; assert structure (valid JSON, required fields), not exact wording.

Rules: tests must run via the command in `docs/STACK.md` (`test:`) so `scripts/verify.sh` picks them up. Don't mock the thing you're trying to verify. A flaky test → fix or delete it; never leave it red. Run the demo path after each deploy against the public URL.

**Done when:** `./scripts/verify.sh` runs at least the demo-path test and passes.
