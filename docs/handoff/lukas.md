# Handoff Lukas: data, passages, GPU-embeddings

## Status

- [x] `src/backend/build_summary.py`: leest `data/vacancies_*.parquet` met DuckDB, ontdubbelt op (title, company, date_posted, country), schrijft `data/summary.json`.
- [x] `src/backend/company_names.py`: normaliseert bedrijfsnamen (suffixen weg, aliassen samengevoegd).
- [x] Ontdubbeling: 1.542.169 ruwe rijen naar 1.341.284 (ruw aantal staat in `data/README.md`; 1.341.284 is opgave van het team, niet in code geverifieerd).
- [ ] Passages splitsen voor de 512-tokenlimiet.
- [ ] Embeddings met multilingual-e5-base op GPU.
- [ ] Embeddings en labels opslaan voor hergebruik.
- [ ] Classifier: vraagt een passage echt om een skill?

## Wat de backend nodig heeft

Een bestand of tabel (Parquet of DuckDB), één rij per bedrijf, skill en periode:

| Kolom | Betekenis |
|---|---|
| `company` | canonieke naam (zoals `normalise_company`) |
| `skill` | skill uit de lijst van Botond |
| `period` | bijvoorbeeld `2025` of een kwartaal |
| `count` | aantal vacatures met de skill |
| `share` | `count` gedeeld door alle vacatures van dat bedrijf in die periode |
| `change` | verandering in `share` tegenover de vorige periode |
| `evidence` | lijst met `vacancy_id` en tekstfragment (`excerpt`) |

Opslaglocatie en bestandsnaam: onbekend, spreek af met Jev.

## Let op

- Vacaturetekst bevat HTML en meerdere talen; ongeveer driekwart is Brits Engels.
- Data van januari tot april 2026 is onvolledig (zie `notes` in de summary).
- Nu zijn skillcijfers trefwoordtellingen (regex), geen gevalideerde skills.

## Mag niet worden aangepast door anderen

`src/backend/build_summary.py`, `src/backend/company_names.py` en de vorm van `data/summary.json`. Lukas meldt wijzigingen in de teamchat, want `chat.mjs` en `router.ts` lezen `per_company`.

## Vragen aan het team

1. Welke periode-indeling (jaar of kwartaal) gebruiken we voor `period` en `change`?
2. Waar leggen we de embeddings neer, zodat Jev ze kan opvragen (data is gelicentieerd, dus niet in git)?
3. Welke F1-drempel moet de passage-classifier halen voordat Botond hem accepteert?
