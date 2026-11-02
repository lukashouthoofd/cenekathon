---
name: deploy-fast
description: Use when you need a public demo URL, a reproducible run command, or the "from prototype to scalable product" story.
---

# Deploy fast

1. **Pick the zero-config host** for the stack: static/Next/Vite → Vercel or Netlify; Python/Node API → Render, Railway or Fly; containers → one `Dockerfile` + `docker compose up`. Free tier is fine.
2. **Deploy the walking skeleton in the first hour,** then redeploy on every merge to `main` (host's GitHub integration; no custom CI needed).
3. **Env vars** go in the host dashboard, mirrored from `.env.example`; never commit `.env`.
4. **Fallback demo:** keep a local run (`docs/STACK.md`: install, dev, test) and a 60-second screen recording — event wifi fails.
5. **Scale story (for the pitch, not for building):** stateless app + managed DB, queue for slow jobs, cache for repeated AI calls, CDN for static, logs/metrics, CI/CD. Write 3 bullets in `docs/PITCH.md` — don't implement.
6. Smoke-test the URL from a phone / incognito window before 19:00.

**Done when:** a public URL serves the latest `main`, and a teammate's fresh clone runs with the documented commands.
