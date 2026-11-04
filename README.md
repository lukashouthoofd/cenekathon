# CenEkathon: AI-readiness assistent

Een prototype voor financiële instellingen die willen weten hoe klaar ze zijn voor AI. De app bevat:

- een **AI-readiness dashboard** (in demo-modus),
- een **actieplan**,
- een **Slack-preview**,
- een **chat** die antwoordt met dashboards; elk antwoord eindigt met advies.

**Pitch deck:** [Figma Slides](https://www.figma.com/slides/mATgE7kG6B65FPtisDteyM/Json-%E2%80%94-Pitch-deck-Cenekathon?node-id=3-2&t=RBoFwF5yTCMQgKag-0)

## Onderdelen

- **Frontend** (`src/frontend`): React + Vite + Tailwind.
- **Chat-backend** (`src/backend/server.mjs`, `chat.mjs`): Node, zonder dependencies. Stuurt vragen naar het AI-model.
- **Datasamenvatting** (`src/backend/build_summary.py`): berekent cijfers uit de vacaturedata in `data/`.

## Lokaal draaien

a. Optioneel: zet de vacaturebestanden in `data/` en run `python src/backend/build_summary.py`. De data is gelicentieerd, alleen voor teamgebruik, en staat niet in de repo. Zonder samenvatting antwoordt de chat zonder cijfers en zegt hij dat erbij.

b. Start de backend (poort 8000): `node src/backend/server.mjs`. Hiervoor heb je `AI_API_KEY` nodig in een lokaal `.env` (kopieer `.env.example`). Commit nooit `.env`.

c. Start de frontend:
```sh
cd src/frontend && npm install && npm run dev
```
Open daarna http://localhost:5173. De Vite-proxy stuurt `/api` naar de backend.

Controle van de hele repo: `sh scripts/verify.sh` (eindigt met `verify: OK`).

## Tests

- Unit-tests: `node --test src/backend/chat.test.mjs`
- Evals: `node src/backend/evals/run-evals.mjs` (dry run, geen netwerk). Met `EVAL_LIVE=1` draait hij tegen de backend; dat vereist een draaiende backend en een aanwezige samenvatting.

## Data-eerlijkheid

- De demo-modus gebruikt gesimuleerde data. Die is als zodanig gelabeld.
- Trefwoordtellingen van vaardigheden in vacatures zijn geen geverifieerde vaardigheden.
