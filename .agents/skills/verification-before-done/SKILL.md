---
name: verification-before-done
description: Use before claiming work is complete, opening a PR, merging, or demoing — run the checks and read the real output.
---

# Verification before done

1. Run `./scripts/verify.sh` (install/build/test as defined in `docs/STACK.md`). Read the output; don't assume.
2. Run the feature the way a user does (browser/CLI): the happy path *and* one failure.
3. `git status`: no stray files, no `.env`, no tokens (`git grep -nIE "sk-|api[_-]?key|secret"`).
4. For anything touching setup, fresh-clone check: `git clone . /tmp/x && cd /tmp/x && <run>`.
5. PR body states: what changed · what was verified (command + result) · what was NOT verified.
6. "Works" without evidence is not "done". If you couldn't verify, say so.
