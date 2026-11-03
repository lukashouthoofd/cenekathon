# Plan

> Teamverdeling & plan, overgenomen uit het teamdocument (Nov 3, 2026). Bijwerken bij elke sync.

## Het idee

We bouwen een AI-native app die veranderingen in de arbeidsmarkt vertaalt naar een concreet AI-actieplan voor één bedrijf. Vacaturedata tonen wat de markt steeds vaker vraagt; interne bedrijfsdata tonen wat het bedrijf vandaag in huis heeft. Het verschil wordt een AI-readinessscore en drie gerangschikte acties. De data is voor de hackathon hardcoded; de agent, MCP naar Claude en Slack, en een minimale frontend vormen het product.

## Teamverdeling

| Subteam | Wie | Eigenaar van | Levert op |
|---|---|---|---|
| Data & analyse | Lukas, Botond | Ruwe data verzamelen en analyseren (hardcoded + jev): vacatures door de tijd + interne bedrijfsdata van één fictief bedrijf | Skill-trends uit vacatures, interne skills- en softwareprofielen, readinessscores met uitleg en datadekking |
| Agent & app | Jev, Salaets, Victor | De agent, MCP-koppeling naar Claude en Slack, minimale frontend | Werkende flow: interne tool, score tonen, drie gerangschikte acties, doorklikken naar de data, integratie met Slack, teams HR, software, opleidingen |

We bouwen een AI-native app: de agent doet het redeneren, de frontend blijft minimaal.

## Architectuur

De twee databronnen worden door het data-team geanalyseerd tot scores en acties; de agent leest die en levert ze via MCP aan Claude, via Slack en in een minimale frontend.

## Data en AI-readinessscore

Twee bronnen worden naast elkaar gelegd: wat de markt steeds vaker vraagt tegenover wat het bedrijf vandaag in huis heeft.

| Bron | Wat eruit komt | Rol |
|---|---|---|
| Vacatures door de tijd | Welke skills belangrijker worden, hoe functies veranderen, welke AI-toepassingen bedrijven zoeken | Veranderende vraag |
| Interne bedrijfsdata | Aanwezige skills, taken per afdeling, gevolgde opleidingen, gebruikte software | Werkelijke situatie |

Uit het verschil volgen drie afzonderlijke scores. Elke score krijgt een uitleg en een indicatie van hoeveel gegevens beschikbaar zijn.

- **Vaardigheden:** marktvraag naar skills tegenover de skills die intern aanwezig zijn
- **Gebruik van AI:** welke AI-software en -toepassingen het bedrijf al gebruikt
- **Opleiding:** gevolgde opleidingen tegenover wat de markt gaat vragen

## Eindscherm: drie gerangschikte acties

Acties worden gerangschikt op verwachte impact, haalbaarheid en kwaliteit van het bewijs. De gebruiker kan doorklikken naar de gegevens achter het advies.

| Actie | Wat we concreet voorstellen |
|---|---|
| Intern opleiden | Welke afdeling welke skills moet leren, wie intern kan begeleiden, welk praktisch project erbij past |
| Bestaande software inzetten | Welk type product een vastgestelde behoefte kan oplossen, rekening houdend met bestaande systemen |
| Een interne tool bouwen | Een concreet toolidee op basis van terugkerende taken, met benodigde skills en een afgebakende pilot |

**Fictief voorbeeld: Prioriteit 1, versnel het zoeken in interne procedures**

- Signaal: vergelijkbare bedrijven vragen vaker vaardigheden rond AI-zoeksystemen.
- Interne behoefte: klantenservice besteedt veel tijd aan het terugvinden van procedures.
- Opleiden: train twee interne begeleiders in broncontrole en het beoordelen van AI-antwoorden.
- Software: onderzoek of de bestaande werkomgeving al een geschikte zoekassistent ondersteunt.
- Intern bouwen: test anders een kennisassistent die antwoorden met bronverwijzingen geeft.
- Eerste stap: pilot binnen één team, meet zoektijd en correctheid.

## Demo-pad en afspraken

De sterkste demo is één bedrijf, van score tot actie:

1. Eén bedrijf kiezen
2. Score met uitleg en datadekking
3. Belangrijkste ontbrekende skill
4. Opleiding, softwareoptie en intern toolidee

Afspraken tussen de subteams:

- [ ] Data-team en app-team spreken vroeg één vaste vorm af voor de hardcoded data (vacaturetrends, interne profielen, scores), zodat de agent er direct op kan bouwen
- [ ] Data-team levert eerst één compleet bedrijf af, uitbreiden komt daarna
- [ ] App-team bouwt eerst de volledige flow met dummydata, dan wisselen we naar de echte analyse
- [ ] Alleen het demo-pad wordt gebouwd; alles daarbuiten valt buiten scope

<!-- Technische details hieronder overgenomen uit main (PR #3). -->

## Contracts

### (a) Chat: POST /api/chat

Request (`ChatRequest` in `src/frontend/src/types.ts`):

```json
{ "messages": [ { "role": "user" | "assistant", "content": "..." } ] }
```

Backend validation (`validMessages` in `chat.mjs`): 1 to 30 messages, `content` a non-empty string up to 4000 characters.

Response (`ChatResponse`):

```json
{
  "message": {
    "role": "assistant",
    "content": "...",
    "dashboard": { "title": "...", "widgets": [ ... ] }
  },
  "mode": "live"
}
```

`dashboard` is optional. `mode` is `'live' | 'demo'` in the frontend type; the backend always returns `'live'`. Only the frontend demo mode returns `'demo'`.

Dashboard widgets (kept only if well-formed by `validWidget` in `chat.mjs`; invalid widgets are dropped):

- Metric: `{ "type": "metric", "label": string, "value": string, "note"?: string }`
- Bar: `{ "type": "bar", "title": string, "unit"?: string, "items": [ { "label": string, "value": number } ] }`

No other widget types exist in the backend or the frontend type (`DashboardWidget`).

Reply parsing (`parseReply`): the last ```json block in the model reply is parsed for `{"dashboard": ...}`. If it is missing or invalid, the whole reply is shown as plain text.

Errors: 400 invalid messages; 500 when `AI_API_KEY` is missing; 504 on a 30 s timeout; 502 for other upstream errors. Also `GET /api/health` returns `{ ok, model, summary }`.

### (b) summary.json (written by `build_summary.py` to `data/summary.json`)

Top-level keys, in order of the script:

- `total_postings`
- `per_year`
- `per_country`
- `per_year_country`
- `top_companies` (list of `{company, postings}`, top 15)
- `company_names` (`distinct_raw_names`, `distinct_canonical_names`, `raw_names_collapsed`)
- `duplicates_removed`
- `skill_keyword_postings_per_year`
- `skill_keyword_share_of_postings_per_year`
- `notes` (list of strings)

The script exits with an error instead of writing if its sanity checks fail.

### (c) Frontend readiness endpoints (src/frontend/src/api.ts)

Not yet implemented by backend. The backend's `handle()` in `chat.mjs` only routes `/api/health` and `/api/chat`; every other path returns 404.

- `GET /api/companies` returns `{ companies: Company[] }`: not yet implemented by backend.
- `GET /api/companies/{id}/readiness` returns `Readiness`: not yet implemented by backend.
- `POST /api/analyze` with `{ companyId, question? }` returns `AnalyzeResponse`: not yet implemented by backend.
- `POST /api/slack/preview` with `{ companyId, actionId }` returns `{ text }`: not yet implemented by backend.

In demo mode (`VITE_DEMO_MODE=true`) these calls return fixtures and make no request.

## Not doing

- Slack bot. BLOCKED: needs Slack app tokens from the team. Only a preview exists in the frontend (`SlackPreviewDialog.tsx`, `getSlackPreview`).
- User accounts and login.
- Mobile app.
- Live scraping of vacancy sites.
- Real readiness endpoints on real data. The dashboard is demo-only (frontend fixtures).
- Public Vercel deploy of vacancy aggregates. Pending licence decision with the team.

## Data honesty

- Vacancy data is licensed, for team use only. It is not in the repo: `data/` is git-ignored, and so is `src/backend/summary.json`.
- `summary.json` is derived from that data and is also git-ignored.
- Skill figures are keyword counts (regex on title and description), not verified skills. The summary notes say so; the chat prompt tells the model to say so.
- The postings are mostly English (about three quarters UK), and data collection was incomplete from January to April 2026 (both from `notes` in `build_summary.py`).
- Duplicates (same title, company, date_posted and country) are removed before counting.
- Demo mode uses simulated data and is labelled as such.
- The "Advies:" line is requested by the chat prompt only. `parseReply` does not check for it.

## Open decisions

See `docs/DECISIONS.md`. Open items there: whether the signed-link docx stays in git history, and the licence decision for a public Vercel deploy of aggregates.

## Slices

| # | Slice (user-visible) | Owner | Status |
|---|----------------------|-------|--------|
| 1 | Walking skeleton, deployed | | TBD |

## Cut line (drop first if behind at 17:30)

TBD.

## Demo story (30 seconds)

TBD.
