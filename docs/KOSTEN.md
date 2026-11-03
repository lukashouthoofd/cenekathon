# Kostenraming AI-onderdelen

Datum: 2026-11-03. Alle bedragen in USD, exclusief btw. Dit is een schatting, geen offerte.

## (a) Prijzen per miljoen tokens

| Model | Input | Output | Cache-lezen | Bron |
|---|---|---|---|---|
| claude-haiku-5-5 | $0,10 (prompt tot 100k tokens) | $0,50 | niet gevonden | techenclave.com (nieuwsbericht, enige bron) |
| claude-sonnet-5-5 | $2,00 | $10,00 | $0,20 of $0,10 (bronnen spreken elkaar tegen) | apidog.com, anotherwrapper.com, pricepertoken.com, techenclave.com |

Opgezocht via webzoekopdracht op 2026-11-03. Dit zijn secundaire bronnen; de officiele Anthropic-prijspagina is niet geraadpleegd. Controleer de prijzen daar voor je ze gebruikt. Prompt caching wordt in de app niet gebruikt (gemeten cache_read = 0), dus de cacheprijs telt niet mee in de raming.

## (b) Gemeten tokens per verzoek (6 live calls, Haiku)

Meting met `data/cost_probe.mjs`: echte systeemprompt uit `src/backend/chat.mjs` plus `data/summary.json`, `max_tokens` zoals de router (800 / 2500 / 1500).

| Type | Input | Output |
|---|---|---|
| kort (2 calls) | 11.393,5 | 218,5 |
| dashboard (2 calls) | 11.400 | 1.260,5 |
| bedrijf (2 calls) | 11.407 | 433,5 |
| gemiddelde (gelijk gewogen) | 11.400,2 | 637,5 |

Steekproef is klein (2 per type); vooral de outputlengte varieert (bedrijf: 834 en 33 tokens).

## (c) Kosten per verzoek

Formule: `kosten = (input x prijs_in + output x prijs_uit) / 1.000.000`. Voor Sonnet zijn dezelfde tokenaantallen gebruikt als gemeten bij Haiku (schatting; Sonnet kan een andere tokenizer en andere antwoordlengtes hebben).

| Type | Haiku | Sonnet |
|---|---|---|
| kort | $0,001249 | $0,024972 |
| dashboard | $0,001770 | $0,035405 |
| bedrijf | $0,001357 | $0,027149 |
| gemiddeld | $0,001459 | $0,029175 |

Per 1.000 verzoeken: Haiku $1,46; Sonnet $29,18.

Uitgewerkt voorbeeld (gemiddeld, Haiku): `(11.400,2 x 0,10 + 637,5 x 0,50) / 1.000.000 = (1.140,02 + 318,75) / 1.000.000 = $0,001459`. Gecontroleerd met `node -e`.

Let op: de router in de app stuurt dashboard- en bedrijfsvragen naar Sonnet en korte vragen naar Haiku. Bij een mix van een derde kort, een derde dashboard en een derde bedrijf is het gemiddelde `(0,001249 + 0,035405 + 0,027149) / 3 = $0,021268` per verzoek.

## (d) Scenario's (30 dagen per maand)

Formule: `maand = verzoeken_per_dag x 30 x kosten_per_verzoek`.

| Verzoeken per dag | Alles Haiku | Alles Sonnet | Router-mix (kort=Haiku, rest=Sonnet) |
|---|---|---|---|
| 50 | $2,19 | $43,76 | $31,90 |
| 500 | $21,88 | $437,63 | $319,02 |
| 5.000 | $218,82 | $4.376,30 | $3.190,20 |

De router-mix is daarmee het realistische scenario; de input (de systeemprompt met data, ruim 11.000 tokens) domineert de kosten. Prompt caching van dat vaste blok zou de inputkosten sterk verlagen, maar is niet ingebouwd en niet gemeten.

## (e) Eenmalige kosten

Het berekenen van embeddings en de classifier op de GPU wordt niet door Anthropic gefactureerd. Dat is stroom en GPU-tijd. Dit is hier niet geschat.

## (f) Niet meegerekend

Vercel-hosting, Slack, Figma en Docker.

## (g) Licentie en data

De vacaturedata zelf wordt niet naar het model gestuurd. Alleen het geaggregeerde samenvattingsblok (`data/summary.json`, 23.513 bytes) gaat mee in de systeemprompt. Dat is circa 10.500 tokens van de gemeten ~11.400 inputtokens (de overige ~900 zijn instructies en de vraag).
