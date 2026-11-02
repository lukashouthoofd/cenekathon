---
name: team-sync
description: Use when 2+ humans or AI agents work in parallel — file ownership, branching, avoiding merge conflicts, and patterns for collaborating with AI tools as a group.
---

# Team sync (parallel humans + agents)

1. **Ownership map** in `docs/TEAM.md`: person → folders/files → current task. One owner per file. Shared files (dependency manifest, lockfile, router index, `docs/PLAN.md`) → announce before editing.
2. **Contract first.** Before splitting front/back, agree the interface (route, JSON shape, function signature) in `docs/STACK.md` or a shared types file. Then both sides mock against it.
3. **Branches:** `<initials>/<task>`; start from fresh `main`; open a PR within 30–45 min; squash-merge. Pull `main` before every task and every ~30 min.
4. **Conflict rule:** whoever merges second resolves. Never force-push `main`. Never `git add -A` blindly — stage your own files.
5. **Agent hygiene:** one agent session per branch/worktree (`git worktree add ../wt-<task> -b <branch>`). Give each agent: the task, the files it may touch, the verification command. Tell it to stop and report rather than refactor neighbours.
6. **Shared context lives in files, not chat:** decisions → `DECISIONS.md`, status → issue comments. Agents re-read files; they forget conversations.
7. **Sync beat:** every 45 min, 3 minutes: done / doing / blocked. Update the cut line.
8. **Review:** skim for secrets, mocks presented as real, and anything that breaks `main`. Approve fast.

**Done when:** no two people share an unplanned file and `main` still runs after every merge.
