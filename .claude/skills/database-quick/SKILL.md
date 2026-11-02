---
name: database-quick
description: Use when the product needs to store data — choosing between JSON/SQLite/Supabase/Postgres, schema design, migrations, seeding, and vector search for RAG.
---

# Database, quickly

## Choose (default: the simplest that survives the demo)
| Need | Use |
|------|-----|
| Static or read-only data | JSON/CSV file in the repo, loaded at startup |
| Single-server persistence | SQLite (`better-sqlite3` / Python `sqlite3`) — caution: serverless hosts (Vercel) have no persistent disk |
| Multi-user, hosted, auth, realtime | Supabase (free tier; Postgres + Auth + Storage + pgvector) |
| Local Postgres in dev | `docker` skill → `postgres:16` |
| Embeddings / semantic search | pgvector (Supabase) or an in-memory index for < 10k items |

## Rules
- Write the schema as a SQL file (`db/schema.sql`) and a seed (`db/seed.sql` or a script) committed to the repo — the DB must be rebuildable in one command.
- Tables: `id` primary key, `created_at`, snake_case names, foreign keys for relations, `text`/`timestamptz`/`jsonb` types. Index columns you filter or join on.
- Parameterized queries only — never string-concatenate user input.
- With Supabase: enable Row Level Security on user-data tables, or keep the service key server-side only. Never ship the service-role key to the browser.
- Keep migrations simple: edit schema, reset and reseed during the hackathon.
- Deeper Postgres guidance: github.com/supabase/agent-skills (`supabase-postgres-best-practices`) — vet before installing.

## RAG mini-recipe
Chunk documents (~500 tokens) → embed → store (pgvector or in-memory) → on query embed the question, take top-k by cosine similarity, put chunks in the prompt, return answer + the source chunks.

**Done when:** a fresh clone + one command creates the schema and seed data, and the app reads and writes it.
