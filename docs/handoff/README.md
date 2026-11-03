# Handoff: wie doet wat

Branch `vt/iteration-3`. Eén pagina; per persoon staat een eigen bestand in deze map.

## Eigenaarschap

| Wie | Deel | Bestand |
|---|---|---|
| Lukas | Data opschonen, passages, GPU-embeddings | `lukas.md` |
| Botond | Validatie skillherkenning, trends, score-inputs | `botond.md` |
| Jev | Backend en MCP-tools voor de agent | `jev.md` |
| Salaets | Claude-agent en acties naar Slack | `salaets.md` |
| Victor | Minimale frontend, uitleg van scores | `victor.md` |

## Gedeelde contractbestanden

- `src/frontend/src/types.ts`: JSON-vorm tussen frontend en backend.
- `src/backend/chat.mjs`: chatcontract en SYSTEM-prompt.
- `src/backend/readiness.mjs`: scoreformules.
- `src/backend/mock/internal-bank.json`: gesimuleerde interne data.
- `data/summary.json` (git-ignored, gebouwd door `src/backend/build_summary.py`).
- `docs/PLAN.md`, `docs/DECISIONS.md`.

Wijzig een contractbestand alleen na overleg in de teamchat, en vermeld het in de PR.

## Werkwijze

1. `git checkout main && git pull`, maak daarna een branch `<initialen>/<korte-taak>` (bij Victor: `vt/...`).
2. Kleine commits; PR naar `main`; één duim omhoog is genoeg.
3. Verifieer voor elke PR: `sh scripts/verify.sh` en lees de uitvoer.
4. Geen echte data of sleutels in git: `data/` en `.env` zijn git-ignored. Mockdata altijd labelen als gesimuleerd.

## Stand van zaken

- Bestaat: `GET /api/companies`, `GET /api/companies/:id/readiness`, `POST /api/chat`, `GET /api/health`.
- Ontbreekt: `POST /api/analyze`, `POST /api/slack/preview`, MCP-tools, passage-embeddings, gevalideerde skilllabels.
- `docs/TEAM.md` is leeg; eigenaarschap per map is dus onbekend buiten dit overzicht.
