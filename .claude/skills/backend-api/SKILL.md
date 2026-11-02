---
name: backend-api
description: Use when building the backend — a small REST/JSON API (FastAPI or Node), validation, error handling, CORS, streaming, and the contract shared with the frontend.
---

# Backend API (small and boring)

- **Pick one:** Python → FastAPI (`pip install fastapi uvicorn pydantic`, run `uvicorn app.main:app --reload`). TypeScript → Next.js Route Handlers (see `frontend-nextjs-vercel`) or Hono/Express. Don't run two backends.
- **Contract first:** list endpoints + request/response JSON in `docs/STACK.md` before coding; share types (Pydantic model ↔ TypeScript type / Zod schema).
- **Validate all input** at the edge (Pydantic/Zod). Return JSON errors `{ "error": "message" }` with proper status codes (400 bad input, 404, 500). Never leak stack traces or keys.
- **Health route:** `GET /health` → `{ "ok": true }` for the deploy platform and your own smoke test.
- **CORS:** allow only the frontend origin (and `localhost` in dev). Frontend and API on one host (Next.js routes) avoids CORS entirely.
- **Slow work (AI calls):** stream the response (SSE / chunked) or return a job id and poll; set timeouts; cache by input hash.
- **State:** start with in-memory or a JSON/SQLite file; move to a managed DB only if the demo needs persistence across restarts (`database-quick`).
- **Config:** read from environment (`AI_API_KEY`, …); fail fast at startup if a required var is missing.
- **Logging:** one log line per request with status and duration; helps debugging during the demo.
- **Auth:** skip unless the brief requires it. If it does, use a hosted provider (Clerk, Supabase Auth) — don't hand-roll.

**Done when:** `curl` against each documented endpoint returns the documented shape, bad input returns a 4xx, and `/health` is green on the deployed URL.
