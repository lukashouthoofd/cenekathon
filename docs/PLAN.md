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
