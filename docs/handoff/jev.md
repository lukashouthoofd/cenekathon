# Handoff Jev: backend en MCP-tools

## Status

- [x] `GET /api/health` geeft `{ ok, model, summary }`.
- [x] `GET /api/companies` geeft `{ companies: Company[] }`.
- [x] `GET /api/companies/:id/readiness` geeft `Readiness` (404 `{ error }` bij onbekend id).
- [x] `POST /api/chat` met modelkeuze via `router.ts`.
- [ ] `POST /api/analyze`.
- [ ] `POST /api/slack/preview`.
- [ ] MCP-tools: samenvatting/SQL-opzoeking, bewijsopzoeking, readiness.
- [ ] `GET /api/overview` (type `Overview` staat in `types.ts`, route niet in de backend gevonden).

## Contracten (uit `types.ts` en `chat.mjs`)

`POST /api/chat`: request `{ messages: [{ role: "user"|"assistant", content }] }`, 1 tot 30 berichten, content 1 tot 4000 tekens. Response `{ message: { role, content, dashboard? }, mode: "live"|"demo" }`. Dashboard `{ title, widgets }` met widgets `{type:"metric",label,value,note?}` of `{type:"bar",title,unit?,items:[{label,value:number}]}`. Fouten: 400, 500 (geen `AI_API_KEY`), 504 (30 s), 502.

`POST /api/analyze`: request `{ companyId, question? }`. Response `{ companyId, summary, actions: Action[], limitations: string[], mode }`. `Action = { id, rank, type: "training"|"software"|"internal_tool", title, department, bullets: string[], pilot, successMetric, evidenceIds: string[] }`.

`POST /api/slack/preview`: request `{ companyId, actionId }`, response `{ text }`.

`Readiness`: `{ companyId, companyName, synthetic, period, scores[], skillGaps[], softwareGaps[], evidence[] }`. Scores 0 tot 100 of `null`; coverage, marketShare, internalCoverage 0 tot 1.

## Voorgestelde MCP-tools

1. Samenvatting/SQL: opzoeken in `data/summary.json` of de passage-tabel van Lukas.
2. Bewijs: vacancy_ids en fragmenten per bedrijf en skill.
3. Readiness: `readinessFor(companyId)` uit `readiness.mjs`.

Onbekend: gekozen MCP-bibliotheek of transport.

## Mag niet worden aangepast door anderen

`src/frontend/src/types.ts` (alleen in overleg met Victor), `server.mjs` en de routering in `chat.mjs`. `package.json` en lockfiles zijn gedeeld: melden voor het wijzigen.

## Vragen aan het team

1. Draait MCP lokaal naast `server.mjs` of in dezelfde Node-server?
2. Wie schrijft `analyze`: Jev (regels) of Salaets (via de agent)?
3. Wat is het besluit over de licentie voor een publieke Vercel-deploy van `api/`?
