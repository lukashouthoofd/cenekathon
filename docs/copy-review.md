# Copy review: zichtbare UI-tekst

Paden zijn relatief aan `src/frontend/src/` (bot: `src/slackbot/`). Alleen gelezen, geen bronbestand aangepast.

| # | Waar | Huidige tekst | Probleem | Voorgestelde tekst |
|---|------|---------------|----------|--------------------|
| 1 | App.tsx:84 | AI-readiness | Jargon | Klaar voor AI? |
| 2 | App.tsx:89 | Demomodus: gesimuleerde gegevens | Redelijk, maar "demomodus" is jargon | Voorbeeldcijfers: dit zijn geen echte bedrijfsgegevens |
| 3 | App.tsx:119 | Dashboard alleen beschikbaar in demomodus | Jargon | Het dashboard is nu niet beschikbaar |
| 4 | App.tsx:121 | Dit dashboard toont gesimuleerde gegevens. Zet VITE_DEMO_MODE=true om het te gebruiken. De chat werkt op echte gegevens. | Technische instructie voor HR. "Echte gegevens" is misleidend: de bedrijfsdata in de chat is ook fictief (zie ChatSidebar:40) | Dit dashboard toont voorbeeldcijfers en staat nu uit. Vraag het team om het aan te zetten. |
| 5 | App.tsx:160 | Maak actieplan | "Actieplan" suggereert een betrouwbaar plan terwijl de cijfers gesimuleerd zijn | Maak voorstel (op basis van voorbeeldcijfers) |
| 6 | App.tsx:180 | gesimuleerde gegevens | Klein en makkelijk te missen naast periodes | Voorbeeldcijfers, niet echt gemeten |
| 7 | App.tsx:215 / ChatView | Er ging iets mis. Probeer het opnieuw. | Zegt niet wat er mis ging | Dit lukte niet. Probeer het zo nog eens. |
| 8 | ScoreCards.tsx:44 | Datadekking 60% | Jargon; HR weet niet wat het betekent | Hoeveel is gemeten: 60% |
| 9 | ScoreCards.tsx:49 | Beperkte data: interpreteer met voorzichtigheid. | Jargon | Er is weinig gemeten. Lees deze score als een grove schatting. |
| 10 | ScoreCards.tsx:41 (formatScore) | Score weergegeven als "Onbekend" | Kan gelezen worden als 0; niet uitgelegd | Onbekend (niet gemeten, dus niet nul) |
| 11 | ScoreCards.tsx:5-7, ChatSidebar.tsx:4 | Vaardigheden / AI-gebruik / Opleiding | Prima, maar elders heet het "skills": wissel niet | Overal "Vaardigheden" |
| 12 | SkillGaps.tsx:14 | Geen skill gaps gevonden | Jargon, Engels | Geen ontbrekende vaardigheden gevonden |
| 13 | SkillGaps.tsx:31 | Ontbrekende skills per afdeling | "Skills" voor wat een trefwoord-telling uit vacatures is; suggereert vastgestelde vaardigheden | Gevraagde vaardigheden die intern lijken te ontbreken, per afdeling |
| 14 | SkillGaps.tsx:45 | 42% van vergelijkbare vacatures | Lijkt een gemeten feit; is een trefwoord in vacatureteksten (en bij de demo-bedrijven gesimuleerd) | 42% van vergelijkbare vacatures noemt dit woord |
| 15 | SkillGaps.tsx:47 | Intern: onbekend | Kan als "nul" gelezen worden | Intern: niet gemeten |
| 16 | SkillGaps.tsx:57 | Maak vacature-concept | OK, maar "concept" wordt niet uitgelegd | Maak conceptvacature |
| 17 | VacancyDraft.tsx:11-16 | "Interne dekking is onbekend en moet eerst gemeten worden" / "Intern dekt 30% van de benodigde skill" | Jargon ("dekking"), "skill" | "Intern is nog niet gemeten wie dit kan" / "Intern kan 30% van de mensen dit al" |
| 18 | VacancyDraft.tsx:62 | Concept. HR controleert functie-eisen, salaris en wettelijke vereisten voordat er iets gepubliceerd wordt. Dit is geen gegenereerde vacature. | Lang; laatste zin verwarrend (de tekst wordt wel automatisch ingevuld) | Dit is een eerste opzet. HR controleert eisen, salaris en wetgeving voor publicatie. |
| 19 | ActionCards.tsx:35 | Demo-output van de agent | "Agent", "output" zijn jargon | Voorbeeldvoorstel van Json, niet gecontroleerd |
| 20 | ActionCards.tsx:42 | Beperkingen | Vaag | Let op: wat deze cijfers niet zeggen |
| 21 | ActionCards.tsx:61,89,93 | Prioriteit / Pilot / Succescriterium | "Pilot" en "succescriterium" zijn jargon | Volgorde / Proefperiode / Wanneer is het gelukt? |
| 22 | ActionCards.tsx:99 | Bekijk Slack-bericht | Onduidelijk of het al verstuurd is | Bekijk bericht voor Slack (nog niet verstuurd) |
| 23 | SlackPreviewDialog.tsx:140 | Demo-voorbeeld — dit bericht is niet verzonden | Goed, alleen in demo zichtbaar; verdwijnt anders | Altijd tonen: "Nog niet verstuurd. Kopieer en plak het zelf in Slack." |
| 24 | ChatSidebar.tsx:40 | fictieve bedrijfsdata | Goed, maar klein; botst met App.tsx:121 ("echte gegevens") | Fictief bedrijf: de cijfers zijn niet echt |
| 25 | ChatSidebar.tsx:61,95 | Grootste kloven / Vraag in de chat welke software ontbreekt. | "Kloven" is vaag, de tweede zin is een opdracht zonder voorbeeld | Grootste tekorten / Vraag Json: "Welke software ontbreekt?" |

## Extra bevindingen (buiten de 25 rijen)

- ChatView.tsx:83-84: voorbeeldvraag is lang en noemt "AI-readiness-assistent". Korter: "Ik ben Json. Stel een vraag over vacatures en vaardigheden, bijvoorbeeld: Maak een dashboard van Bank Vandermeulen."
- ChatSidebar.tsx:124: "Gebaseerd op 3 echte vacatures" is correct (vacaturedata is echt), maar zet erbij dat het bedrijf fictief is.
- bot.mjs:82: "Skill-gaps voor X (gesimuleerd)" gebruikt Engels jargon. Voorstel: "Ontbrekende vaardigheden voor X (voorbeeldcijfers)".
- bot.mjs:84: "markt 40%, intern onbekend". Voorstel: "40% van vergelijkbare vacatures, intern niet gemeten".
- bot.mjs:128: knop "Verstuur naar HR" is duidelijk. Het bericht zegt "Voorstel voor HR:" zonder dat het nog niet verstuurd is; voeg toe: "Pas verstuurd na je klik."
- bot.mjs:121: "(SLACK_CHANNEL_HR)" is een technische naam in een bericht aan HR. Voorstel: "Het HR-kanaal is nog niet ingesteld. Vraag het team."
- chat.mjs system prompt zegt zelf dat skill-aantallen trefwoordtellingen zijn, maar de UI doet dat niet (rijen 13 en 14).
