---
name: git-github
description: Use for any git or GitHub operation in the team repo — creating the repo from the template, branches, PRs with gh, issues, resolving conflicts, and recovering from mistakes.
---

# Git & GitHub (team flow)

```bash
# one person: create the team repo from the template, add collaborators in Settings → Collaborators
gh repo create <team> --template lukashouthoofd/cenekathon-starter --public --clone
# everyone else
git clone <url> && cd <repo> && cp .env.example .env

# every task
git switch main && git pull
git switch -c <initials>/<task>
git add <your files> && git commit -m "feat: short message"
git push -u origin HEAD
gh pr create --fill          # template asks for what/verified/not-verified
gh pr merge --squash --delete-branch
```

- **Issues as tasks:** `gh issue create --title "..." --body "..."`, `gh issue list`, `gh issue close N`.
- **Conflicts:** `git fetch && git merge origin/main` on your branch, fix the marked files, run `./scripts/verify.sh`, commit. Prefer merging over rebasing under time pressure. The second merger resolves.
- **Undo safely:** unstage `git restore --staged <f>`; discard file `git restore <f>`; undo a pushed commit `git revert <sha>`. Don't `reset --hard` or force-push shared branches.
- **Committed a secret?** Rotate the key first, then remove it from history; assume it's leaked.
- **Never** `git add -A` blindly (catches `.env`, build output). Review `git status` and `git diff --staged`.
- **Worktrees** for parallel agents: `git worktree add ../wt-<task> -b <initials>/<task>`.
- **Commit messages:** imperative, one line, `feat:` / `fix:` / `docs:` prefix.
- Check CI: `gh run list --limit 3`, `gh run watch`.
