# Handoff Victor: frontend en scoreuitleg

## Status

- [x] Frontend in `src/frontend` (Vite, React): tabs Dashboard en "Json" (chat) in `App.tsx`.
- [x] Demo-modus `VITE_DEMO_MODE=true`: fixtures, geen requests, gelabeld als gesimuleerd (`api.ts`).
- [x] `GET /api/companies` en `GET /api/companies/:id/readiness` bestaan in de backend.
- [x] Slack-voorbeelddialoog (`SlackPreviewDialog.tsx`).
- [ ] Bewijspaneel is op `main` verwijderd; terugzetten of vervangen is open.
- [ ] `POST /api/analyze` ontbreekt in de backend (alleen demo-fixtures).
- [ ] `POST /api/slack/preview` ontbreekt in de backend.
- [ ] `GET /api/overview` ontbreekt in de backend (type bestaat).
- [ ] Json-tab: livechat via `VITE_LIVE_CHAT=true`; tegen echte backend niet gecontroleerd.
- [ ] Scoreuitleg tonen: `explanation` en `coverage`; `null` als "onbekend", nooit als 0.

## Verificatie

```
sh scripts/verify.sh
npm run --prefix src/frontend typecheck
npm run --prefix src/frontend build
node --test src/backend/readiness.test.mjs
```

Lokaal: backend `node src/backend/server.mjs` (poort 8000), frontend `npm run --prefix src/frontend dev`. De `.env` staat in de repo-root en gaat nooit in git.

## Mag niet worden aangepast door anderen

`src/frontend/**`, met name `types.ts` (contract: wijzigingen in overleg met Jev) en `fixtures/bank.ts` (moet gelijk blijven aan `internal-bank.json`).

## Vragen aan het team

1. Komt het bewijspaneel terug, of verwijst de agent in tekst naar bewijs?
2. Wie levert `/api/analyze` op tijd voor de demo? Anders blijven we op fixtures.
3. Tonen we `mode: "demo"` zichtbaar in de UI?
