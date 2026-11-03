---
name: security-basics
description: Use before deploying or pitching, and whenever handling API keys, user input, uploads, auth or personal data — a quick pass on the mistakes that actually bite at hackathons.
---

# Security basics (10-minute pass)

1. **Secrets:** nothing in git. `git grep -nIE "sk-|api[_-]?key|secret|token|BEGIN .*PRIVATE"`; check `git log -p` if a key was ever committed → **rotate it**, deleting the line isn't enough. `.env` ignored, `.env.example` complete. Keys live server-side; `NEXT_PUBLIC_*` / client code is public.
2. **Shared AI tokens** from the organisers: don't paste them in chat, issues, screenshots or the demo recording.
3. **Input:** validate server-side; parameterized SQL; escape or sanitize anything rendered as HTML (LLM output counts as untrusted); limit upload size and type.
4. **LLM-specific:** user text and retrieved documents can contain prompt injection — never let model output trigger destructive actions or run as code/shell without a human check; don't put secrets in system prompts.
5. **Access:** if there's a login, check authorization on the server for every data read (not just hiding buttons). Hosted DB: RLS on, service-role key never in the browser.
6. **Rate/cost guard:** cap tokens per request and requests per IP/session on public AI endpoints so the shared budget survives the pitch.
7. **Privacy:** use synthetic or public data in the demo; no real personal data in prompts, fixtures or screenshots.
8. **Dependencies:** install only packages you've heard of; check the exact name (typosquats, hallucinated packages) — `npm view <pkg>` / `pip index versions <pkg>`.
9. **Deploy:** HTTPS only (hosts do this), no debug mode in production, no verbose errors to users.

10. **Aikido:** `.github/workflows/aikido.yml` scans every PR for new critical dependency vulnerabilities. Needs `AIKIDO_SECRET_KEY` (`gh secret set AIKIDO_SECRET_KEY`); skipped until set. Optional: Aikido Safe Chain (`npm i -g @aikidosec/safe-chain`) blocks malicious npm packages at install time.

**Done when:** the grep is clean, `.env` is untracked, public endpoints have a size/rate cap, and the demo uses no real personal data.
