# Handoff Botond: validatie, trends, score-inputs

## Status

- [x] Readinessformules in `src/backend/readiness.mjs` (skills, ai_usage, training), deterministisch uit de mock.
- [x] Mock `src/backend/mock/internal-bank.json` (demo-bank, gesimuleerd) met `departments`, `skills_inventory`, `training_records`.
- [x] `per_company` in `data/summary.json`: `postings_total`, `postings_per_year`, `skill_keyword_share_2025` (trefwoorden).
- [ ] Gevalideerde skilllabels (nu alleen regex).
- [ ] Functiegroepen.
- [ ] Lijst van 30 tot 50 skills.
- [ ] Gelabelde steekproef van 30 tot 50 voorbeeldpassages plus aparte test-set.
- [ ] `marketShare` uit echte trends (staat nu hardcoded in `MARKET_SHARE` in `readiness.mjs`).

## Wat de formules als input nodig hebben

- Skills: per skill `skillId`, `name`, `department`, `internal_coverage` (0 tot 1 of `null`) uit `skills_inventory`, plus `marketShare` (0 tot 1). Score is de gewogen dekking over skills met een meting.
- AI-gebruik: per afdeling `headcount` en `employees_with_ai_tool_use_90d` (kan `null`). Score is `null` bij minder dan 3 gemeten afdelingen.
- Opleiding: per record `employee_anon_id`, `department`, `skill_id` (kan `null`), `completed_on`. Geteld worden unieke medewerkers met een opleiding op een tekortvaardigheid van hun afdeling.
- Periode: `period` met `from`, `to`, `comparisonFrom`, `comparisonTo`.
- Een `null`-score betekent "onbekend" en mag nooit als 0 worden getoond.

## Controle

`node src/backend/mock/validate-mock.mjs` (verwacht `mock ok`) en `node --test src/backend/readiness.test.mjs`.

## Mag niet worden aangepast door anderen

De skill-ids en de lijst in `MARKET_SHARE`; `internal-bank.json` blijft gelijk aan `src/frontend/src/fixtures/bank.ts`. Wijzig beide samen.

## Vragen aan het team

1. Welke 30 tot 50 skills nemen we op, en gelden ze voor alle bedrijven?
2. Hoe groot moet de held-out test-set zijn en wie labelt?
3. Is `marketShare` het aandeel vacatures per bedrijf of per sector (nu: "vergelijkbare vacatures")?
