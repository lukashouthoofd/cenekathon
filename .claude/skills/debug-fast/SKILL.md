---
name: debug-fast
description: Use when something is broken, failing, or behaving unexpectedly — evidence-first debugging with strict time limits.
---

# Debug fast

1. **Reproduce** with the smallest command/input. Copy the *exact* error.
2. **Read the error** fully (first and last lines); check what changed (`git diff`, `git log -5`).
3. **One hypothesis at a time**, tested with a log/print/breakpoint — never change three things at once.
4. **Fix the root cause**, re-run the repro, then `./scripts/verify.sh`.
5. **Limits:** 3 failed attempts or 15 minutes → stop, write what you know in the issue, then try a different approach (revert, simpler path, mock it) or ask a teammate. In a hackathon, *routing around* beats *understanding fully*.
6. Usual suspects: stale env vars, wrong port, CORS, missing `.env`, lockfile conflict, a hallucinated API or package (verify against the docs, `npm view` / `pip index versions`).
