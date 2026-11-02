---
name: docker
description: Use when containerizing the app, writing a Dockerfile or compose.yaml, running services (Postgres, Redis, API) locally with docker compose, or debugging container builds.
---

# Docker & Compose

## When it helps
Reproducible "works on every teammate's laptop" setup, running a DB/queue locally, or deploying to a container host (Render, Fly, Railway, Cloud Run). If the app is a plain Next.js site on Vercel, you don't need Docker — skip it.

## Dockerfile rules
```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim AS build            # pin a version, never :latest
WORKDIR /app
COPY package*.json ./                 # deps first → cached layer
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
USER node                             # non-root
EXPOSE 3000
CMD ["npm","start"]
```
- Multi-stage; copy dependency files before source; combine `RUN`s; clean package caches in the same layer.
- Always add a `.dockerignore` (`node_modules`, `.git`, `.env*`, `dist`, `.venv`).
- **No secrets in the image** (no `COPY .env`, no `ENV KEY=...`). Pass at runtime: `--env-file .env` or compose `env_file`.
- Python: `python:3.12-slim`, `pip install --no-cache-dir -r requirements.txt`, run with `uvicorn app:app --host 0.0.0.0`. Bind to `0.0.0.0`, not `localhost`, or the port is unreachable.

## compose.yaml (app + db example)
```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
  db:
    image: postgres:16
    environment: { POSTGRES_PASSWORD: dev, POSTGRES_DB: app }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 3s
      retries: 10
volumes: { pgdata: {} }
```
Dev-only passwords are fine locally; never reuse them in production.

## Commands
```bash
docker compose config            # validate the file first
docker compose up --build -d     # start
docker compose logs -f api       # logs
docker compose ps                # health/ports
docker compose down -v           # stop + wipe volumes
```

## Debugging
- Build fails: read the first failing layer, run its command in `docker run --rm -it <base> sh`.
- Port busy: change the left side of `"8000:8000"`. Service can't reach db: use the *service name* as host (`db`), not `localhost`.
- Slow builds: check layer order and `.dockerignore`.

**Done when:** `docker compose up --build` works on a fresh clone with only `.env` created from `.env.example`.
