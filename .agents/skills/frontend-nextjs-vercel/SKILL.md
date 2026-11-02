---
name: frontend-nextjs-vercel
description: Use when building a web UI with React/Next.js and deploying it on Vercel — project setup, App Router patterns, performance basics, env vars, preview and production deploys.
---

# Frontend: Next.js + Vercel

## Setup (5 min)
```bash
npx create-next-app@latest web --ts --tailwind --app --eslint --use-npm --yes
cd web && npm run dev
```
Add UI kit only if needed: `npx shadcn@latest init` then `npx shadcn@latest add button card input` (copy-in components, no lock-in).

## Structure
- `app/page.tsx` landing/demo screen; `app/api/<name>/route.ts` for server endpoints (keeps API keys server-side); `components/`; `lib/` (llm client, helpers).
- **Server Components by default.** Add `"use client"` only for state, effects, or event handlers. Keep client components small and leaf-level.
- Fetch data on the server (`async` page) and pass props; use Route Handlers or Server Actions for mutations.
- Secrets only via `process.env.X` in server code. Only `NEXT_PUBLIC_*` reaches the browser — never put a key there.

## Performance basics (cheap wins)
- Avoid request waterfalls: start independent fetches together with `Promise.all`.
- `next/image` for images, `next/font` for fonts; lazy-load heavy components with `next/dynamic`.
- Stream slow AI/data parts with `<Suspense fallback={…}>` so the page shows instantly.
- Don't import big libraries into client components; no barrel-file mega imports.
- Deeper guidance: github.com/vercel-labs/agent-skills (react-best-practices, composition-patterns) — vet before installing (see `find-skills`).

## UX that demos well
Loading, empty and error states for every async view; disable buttons while pending; show results progressively. See `ui-polish`.

## Deploy
```bash
npm i -g vercel          # once
vercel login             # humans only — never script credentials
vercel link              # from the web/ folder; set Root Directory if in a monorepo
vercel env add AI_API_KEY production   # (and preview); mirror .env.example
vercel                   # preview URL
vercel --prod            # production URL
```
Or connect the GitHub repo in the Vercel dashboard so every merge to `main` deploys and every PR gets a preview URL. Remember function timeouts on the free tier: keep AI routes streaming or under ~10–60 s.

**Done when:** `npm run build` passes locally, the Vercel URL works in an incognito window, and no secret is in the client bundle (`git grep NEXT_PUBLIC`).
