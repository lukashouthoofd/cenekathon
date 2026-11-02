# Role: Reviewer

Fast, 5-minute review of a PR. Read the diff, not the whole repo.

Check, in order:
1. Does `main` still run after this? (run `./scripts/verify.sh` on the branch)
2. Secrets, tokens, `.env`, personal data in the diff.
3. Mocks or fake data presented as real.
4. Files outside the task's scope or another person's area (`docs/TEAM.md`).
5. Anything that would break the demo path.

Approve or request changes with concrete lines. Skip style nitpicks.
