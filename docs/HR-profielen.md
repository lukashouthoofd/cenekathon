# Profielen en skills voor vacatures (concept voor HR)

> Gesimuleerde interne gegevens: de bank Vandermeulen is fictief. Marktcijfers zijn trefwoordtellingen uit echte vacatures, geen bewezen skills.

## Hoe te lezen

- Een **gat** betekent: een skill die de markt vraagt, waarvoor de bank intern weinig dekking heeft.
- **marketShare** is het aandeel vergelijkbare vacatures dat de skill vraagt (fixture-cijfer).
- **null** betekent onbekend, niet nul: er zijn dan geen interne gegevens.

## 1. Risk: Modelmonitoring

- Markt (marketShare): 34%. Intern (internalCoverage): 12%.
- Gat: een derde van de vergelijkbare vacatures vraagt dit, maar intern is het bij weinig profielen aanwezig.
- Rol: Model Risk Analist (opleiden).
- Profiel: drift-detectie, modelvalidatie, monitoringplannen opstellen, hoofdlijnen van machine learning-modellen begrijpen, risicorapportage aan het management.
- Concept vacaturetekst: "Als Model Risk Analist valideer en monitor je risicomodellen, waaronder machine learning-modellen. Je bewaakt drift en rapporteert afwijkingen. Ervaring met modelmonitoring is een sterke troef. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-1, ev-vac-6, ev-int-1.

## 2. Compliance: AI Act-compliance

- Markt (marketShare): 29%. Intern (internalCoverage): 18%.
- Gat: de vraag naar AI Act-kennis steeg sterk ten opzichte van de vergelijkingsperiode.
- Rol: Compliance Officer AI & Data (opleiden).
- Profiel: risicoclassificatie van AI-systemen, AI Act en interne beleidskaders, AI-register en documentatie, GDPR, werken met een GRC-tool.
- Concept vacaturetekst: "Als Compliance Officer AI & Data toets je AI-toepassingen aan de AI Act en aan onze interne beleidskaders. Je classificeert AI-systemen op risico en beheert het register van toepassingen. Kennis van risicoclassificatie is vereist. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-2, ev-der-1.

## 3. Finance & Control: Python voor data-analyse

- Markt (marketShare): 41%. Intern (internalCoverage): 31%.
- Gat: veelgevraagd voor rapportage-automatisering; intern bij bijna een derde van de profielen.
- Rol: Financial Controller (opleiden).
- Profiel: Python en SQL voor maandrapportages, datakwaliteitscontroles, afwijkingsanalyse, kritisch gebruik van LLM-tools voor toelichtingen.
- Concept vacaturetekst: "Als Financial Controller automatiseer je maandrapportages met Python en SQL. Je bereidt met LLM-tools toelichtingen op afwijkingen voor en controleert die inhoudelijk. Ervaring met Python of SQL is een pré. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-3, ev-int-2.

## 4. Klantendienst: Prompt engineering / LLM-gebruik

- Markt (marketShare): 22%. Intern (internalCoverage): 4%.
- Gat: weinig interne dekking, terwijl klantenservicefuncties AI-assistenten verwachten.
- Rol: Medewerker Klantendienst Digitaal (opleiden, daarna tool: interne assistent).
- Profiel: prompts schrijven, antwoorden kritisch nakijken, werken met een kennisbank, correcties vastleggen, omgang met klantgegevens volgens de AVG.
- Concept vacaturetekst: "Als Medewerker Klantendienst Digitaal werk je met AI-assistenten om klantvragen sneller te beantwoorden. Je schrijft goede prompts en controleert elk antwoord voordat het verstuurd wordt. Ervaring met AI-tools is een pré. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-4, ev-int-2 (zie controlepunt hieronder).

## 5. IT: Data governance

- Markt (marketShare): 26%. Intern (internalCoverage): onbekend.
- Gat: de marktvraag is duidelijk, maar er zijn geen interne gegevens om de huidige dekking te bepalen.
- Rol: Data Governance Lead (vacature; eerst interne dekking meten).
- Profiel: datakwaliteitsraamwerk, datalineage en herkomst, toegangsbeheer, dataeigenaarschap, AVG, governance van data voor AI.
- Concept vacaturetekst: "Als Data Governance Lead bouw je het datakwaliteits- en governanceraamwerk verder uit. Je bewaakt herkomst en toegang van data die voor AI wordt gebruikt. Ervaring met datakwaliteit en AVG-vereisten is vereist. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-5, ev-missing-1 (zie controlepunt hieronder).

## 6. IT: MLOps

- Markt (marketShare): 17%. Intern (internalCoverage): 9%.
- Gat: beperkte maar groeiende vraag; intern nauwelijks aanwezig.
- Rol: Software Engineer Data Platform (vacature).
- Profiel: MLOps-pijplijnen, modelmonitoring in productie, CI/CD, tools bouwen op LLM-API's, versiebeheer van modellen, Python.
- Concept vacaturetekst: "Als Software Engineer Data Platform ontwikkel je interne tools bovenop LLM-API's. Je beheert de MLOps-pijplijn voor modelmonitoring. Ervaring met Python en CI/CD is vereist. *Concept, juridisch te controleren door HR.*"
- Bewijs: ev-vac-6.

## Overzichtstabel

| Afdeling | Skill | Markt % (2025, trefwoord) | Intern % | Actie |
|---|---|---|---|---|
| Risk | Modelmonitoring | 0,71% | 12% | Opleiden |
| Compliance | AI Act-compliance | 0,06% | 18% | Tool (AI-register) en opleiden |
| Finance & Control | Python voor data-analyse | 7,89% | 31% | Opleiden |
| Klantendienst | Prompt engineering / LLM-gebruik | 3,92% | 4% | Opleiden en tool (assistent) |
| IT | Data governance | 1,59% | onbekend | Vacature; eerst meten |
| IT | MLOps | onbekend | 9% | Vacature |

De kolom "Markt %" komt uit data/summary.json (aandeel van alle vacatures in 2025, trefwoordtelling). De marketShare-cijfers in de secties hierboven komen uit de fixture. Die twee metingen zijn niet vergelijkbaar.

## Wat HR moet controleren

- **Juridisch:** de AI Act is relevant voor AI-toepassingen in de bank. AI-geletterdheid (artikel 4) geldt sinds 2 februari 2025. De toepasselijke datums voor hoogrisicoverplichtingen moeten juridisch worden gecontroleerd.
- **Ondernemingsraad:** opleidings- en monitoringregelingen die gegevens over werknemers vastleggen, kunnen instemming van de OR vereisen (WOR).
- **Toezicht:** eventuele eisen van de toezichthouder aan modelvalidatie en modelrisico, te toetsen met Compliance.
- **Salarissen:** bandbreedtes niet ingevuld. Invullen door HR.
- **Gesimuleerde data:** alle interne cijfers (12%, 18%, 31%, 4%, 14 van 210 medewerkers) zijn gesimuleerd. Gebruik ze niet als feiten.
- **Geen bewezen skills:** trefwoordcijfers tellen woorden in titels en omschrijvingen. Ze bewijzen geen vaardigheid.
- **Bewijs:** ev-missing-1 wordt in de fixture gebruikt maar is niet gedefinieerd. ev-int-2 meet Python of SQL en is daarom geen bewijs voor prompt engineering.
