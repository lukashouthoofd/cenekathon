# CenEkathon starter

Team starter for the [CenEkathon](https://ceneka.be/activity/cenekathon) (CenEka × Techwolf, 3 Nov 2026, iGent Gent): a 6-hour build with an agent-ready setup that works with **any** AI coding tool — Claude Code, Codex, Gemini CLI, Copilot, Cursor.

## Use it

1. Click **Use this template** on GitHub (or `gh repo create <team> --template <owner>/cenekathon-starter --public --clone`).
2. Add teammates as collaborators. Everyone: `cp .env.example .env`, fill in the AI tokens from the organisers.
3. Fill `docs/TEAM.md`. At 13:00 paste the brief into `docs/CHALLENGE.md`, then tell your agent:
   > Read AGENTS.md and run the `kickoff` skill on docs/CHALLENGE.md.
4. Run `sh scripts/sync-skills.sh` once if you use Claude Code (mirrors skills to `.claude/skills/`).

## What's inside

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Single authoritative instruction file for every agent. `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` just point to it |
| `.agents/skills/` | 25 skills (open [Agent Skills](https://agentskills.io/specification) format): `kickoff` · `rapid-prototype` · `team-sync` · `ai-in-the-product` · `deploy-fast` · `debug-fast` · `verification-before-done` · `demo-and-pitch` · `repo-polish` · `find-skills` · `frontend-nextjs-vercel` · `ui-polish` · `backend-api` · `database-quick` · `docker-project-foundations` · `docker-build-strategies` · `docker-compose-patterns` · `docker-destructive-guardrails` · `deploy-to-vercel` · `vercel-react-best-practices` · `vercel-composition-patterns` · `data-ml-quickstart` · `smoke-testing` · `security-basics` · `git-github` |
| `.agents/roles/` | `architect`, `builder`, `reviewer` role prompts |
| `docs/` | `CHALLENGE` · `PLAN` · `DECISIONS` · `TEAM` · `STACK` · `PITCH` · `SCHEDULE` — shared memory for humans and agents |
| `scripts/` | `verify.sh` (the "done" contract), `check-skills.sh`, `sync-skills.sh` |
| `.github/` | CI (runs `verify.sh`), Aikido PR security scan (needs `AIKIDO_SECRET_KEY`), PR template, task issue template |

## Tools that don't read AGENTS.md automatically

Tell the agent: *"Read AGENTS.md first, and read `.agents/skills/<name>/SKILL.md` when relevant."*

## Design notes

Modelled on a production setup (single `AGENTS.md`, canonical `.agents/` skills mirrored for Claude, plan-before-code, one verification command, separate planner/builder roles) and trimmed to hackathon scale: no plan-gate tooling, a demo-first rule, and pitch/deploy skills. Docker and Vercel skills are copied verbatim from [docker/skills](https://github.com/docker/skills) and [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (see `.agents/skills/THIRD_PARTY.md`). Format and patterns informed by [agentskills.io](https://agentskills.io/specification), [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) and [abhilashpandurangan/hackathon-prep](https://github.com/abhilashpandurangan/hackathon-prep).

## License

MIT
