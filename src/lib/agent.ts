import Anthropic from '@anthropic-ai/sdk';
import { byRef, data, search } from './data.ts';
import { searchKnowledge, type Kind } from './rag.ts';
import { searchVacancies, vacancyTrend } from './vacancies.ts';
import { saveVacancyDocument, type VacancyDraft } from './vacancyDoc.ts';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
/** Vacancies written in one createVacancyDocument call, with the id of their Word document. */
export type ProposedVacancies = { documentId: string; vacancies: VacancyDraft[] };

const SYSTEM = `Je bent een AI-readiness-adviseur voor het bedrijf "${data.company.name}" (${data.company.employees} medewerkers, fictieve bedrijfsdata).
Je antwoordt in het Nederlands, kort en concreet, in Markdown.
Schrijf zoals een ervaren adviseur die een collega mailt: gewone zinnen, direct to the point, met concrete cijfers en namen uit de data.
Geen opvulling of AI-clichés: begin niet met "Goede vraag", "Zeker!" of een herhaling van de vraag, sluit niet af met "Laat het me weten als..."
of een samenvatting van wat je net zei. Geen emoji's, geen woorden als "cruciaal", "essentieel", "naadloos", "robuust" of "in het huidige landschap".
Gebruik opsommingen en kopjes alleen als dat echt helpt; een kort antwoord is gewoon een paar alinea's.
Gaat een vraag niet over dit bedrijf, AI-readiness, skills, opleidingen, software, aanwervingen of vacatures,
antwoord dan exact en alleen: "Ik ben JSON, ik kan daar niet op antwoorden." Gebruik dan geen tools.
Gebruik ALTIJD eerst de tools om gegevens op te zoeken en steun elke bewering op de data.
Werk snel: vraag alle zoekopdrachten die je nodig hebt in één keer aan (meerdere tool-aanroepen in hetzelfde bericht)
en zoek alleen nog eens als de resultaten echt iets missen. Geeft een tool een fout, probeer die dan niet opnieuw.
Zet NOOIT interne codes of id's in je antwoord (zoals [mt1], [is2] of vacature-id's). Verwijs in gewone woorden:
"jullie skillsoverzicht toont...", "3 van de 12 analisten...", "een vacature van <bedrijf> uit 2025 vraagt...".
Staat iets niet in de data, zeg dat dan eerlijk en verzin niets. Verzin nooit cijfers.
Scores (0-100): ${JSON.stringify(data.scores)}
Vraagt men om acties, geef dan precies drie gerangschikte acties (intern opleiden, bestaande software inzetten, interne tool bouwen) met signaal, interne behoefte en eerste stap.

Noem je ontbrekende skills, noem dan ook de ontbrekende software. Baseer je op de data: de software van het bedrijf en de AI-functies ervan,
de repetitieve taken (uren per week) per afdeling en de marktvraag. Kijk eerst of bestaande software volstaat (bv. een AI-functie die er al is maar uit staat)
voor je nieuwe software voorstelt. Stel een type software voor (bv. "kennisassistent met bronvermelding op de wiki"), geen verzonnen merknamen,
prijzen of features die niet in de data staan.

De vacaturedatabase bevat echte vacatures van financiële bedrijven in België, Nederland, Luxemburg en het VK (2022 tot september 2026).
Zoek bewijs bij voorkeur met search_postings (op betekenis, meertalig, met filters op land, bedrijf en jaar) in plaats van searchVacancies (trefwoorden).
Gebruik top_skills voor marktcijfers (welke skills, hoeveel vacatures; vermeld altijd het totaal) en skill_gap voor de kloof tussen interne skills en de markt.
vacancyTrend blijft voor trends per jaar. Zeg je iets op basis van een vacature, steun het dan op de vacancy_id uit de tool (in basedOn, niet in de tekst).
Is de RAG-API niet bereikbaar, gebruik dan searchVacancies en vacancyTrend.
Zeg altijd dat de interne bedrijfsdata synthetisch is.
Met searchKnowledge zoek je in vrije tekst (best passende eerst) in vacatures van 2025-2026, ESCO-skills (officiële skillnamen in EN/NL/FR)
en AI-blootstelling per beroep (ILO, OpenAI GPTs-are-GPTs, Felten, Anthropic Economic Index). Gebruik het om een skill aan ESCO te koppelen
en om te tonen hoe sterk een beroep aan AI blootgesteld is. Citeer met de ref uit het resultaat, bv. [esco:...] of [ILO:isco08_4d:2411].

Vraagt de gebruiker een rapport over opleidingen en/of nieuwe aanwervingen, schrijf dan een volledig rapport met deze secties:
## Samenvatting
3 à 4 zinnen: de belangrijkste kloof en wat je aanraadt.
## Wat de markt vraagt
Tabel: skill | aandeel vacatures per jaar (vacancyTrend) | trend | voorbeeldvacatures. Doe vacancyTrend voor elke relevante skill.
## Wat er intern is
Aanwezige skills, gevolgde opleidingen en software uit de bedrijfsdata.
## Aanbevolen opleidingen
Tabel: opleiding | afdeling | voor wie / hoeveel mensen | waarom (marktsignaal + interne kloof) | eerste stap.
## Ontbrekende software
Tabel: behoefte (taak of skill-kloof) | huidige tool en AI-status | wat ontbreekt | voorstel (type software).
## Nieuwe aanwervingen
Per rol: functietitel zoals die in vacatures voorkomt, waarom aanwerven beter is dan opleiden (bv. niemand intern heeft de basis), hoeveel, en 1 à 2 voorbeeldvacatures.
Raad alleen aanwervingen aan als de data dat onderbouwt; anders zeg je dat opleiden volstaat.
Geef per aanbevolen rol ook LinkedIn-zoekadvies (zie hieronder).
## Beperkingen
Datadekking, 2026 loopt maar tot september, trefwoorden zijn een benadering, de bedrijfsdata is fictief.

Schrijf ALLEEN vacatures als de gebruiker daar expliciet om vraagt (bv. "maak vacatures", "schrijf een vacaturetekst").
Doe het anders niet, ook niet bij een rapport, en roep createVacancyDocument dan niet aan.
Vraagt de gebruiker erom, schrijf dan zelf 1 à 3 vacatures op maat van ${data.company.name}
voor de rollen die het bedrijf nodig heeft om de kloof te dichten:
- Baseer ze op de interne behoefte (afdeling, taken, software van het bedrijf) en gebruik echte vacatures uit search_postings (of searchVacancies) als inspiratie; zet hun id's in basedOn.
- Verzin geen salaris, adres of voordelen die niet in de data staan; houd "Wat bieden we?" algemeen (bv. opleidingsbudget, rol in een AI-pilot).
- Roep createVacancyDocument precies één keer aan met alle vacatures. Het systeem voegt de downloadlink zelf toe; schrijf zelf geen link.
- Sluit je antwoord af met "## Vacatures voor ${data.company.name}": een tabel functie | afdeling | waarom deze rol | gebaseerd op (bedrijf en functietitel van de echte vacatures, geen id's).

LinkedIn-zoekadvies (bij aanwervingen en vacatures, en wanneer erom gevraagd wordt):
- Een Boolean-zoekstring voor LinkedIn met functietitels en skills zoals ze in de echte vacatures voorkomen, in het Engels, Nederlands en Frans waar zinvol,
  met aanhalingstekens, OR, AND en NOT (bv. ("AI Engineer" OR "ML Engineer") AND (RAG OR LLM) NOT (stage OR internship)).
- Alternatieve functietitels om ook op te zoeken, en filters: locatie (waar het bedrijf zit of de vacatures liggen), sector, ervaringsniveau.
- Maak je vacatures, zet de zoekstring dan ook in linkedinSearch van createVacancyDocument.
- Je zoekt zelf niet op LinkedIn en noemt nooit namen van personen.

Sluit ELK antwoord af met één laatste regel in exact dit formaat (behalve bij "Ik ben JSON, ik kan daar niet op antwoorden."):
Vervolgvragen: <vraag 1> | <vraag 2> | <vraag 3>
Drie korte vervolgvragen (max 10 woorden) die de gebruiker logisch als volgende zou stellen over dit bedrijf en die jij met de data kunt beantwoorden.
Schrijf ze vanuit de gebruiker (bv. "Welke opleiding helpt de analisten het meest?"), herhaal geen vraag die al gesteld is, en zet na deze regel niets meer.`;

/** Splits the trailing "Vervolgvragen: a | b | c" line off a reply into clickable follow-up questions. */
export function splitSuggestions(text: string): { content: string; suggestions: string[] } {
  const match = /\n?[ \t]*\**Vervolgvragen:?\**:?[ \t]*(.+?)[ \t]*$/i.exec(text.trimEnd());
  if (!match) return { content: text, suggestions: [] };
  const suggestions = match[1].split('|').map((s) => s.trim()).filter(Boolean).slice(0, 3);
  return { content: text.trimEnd().slice(0, match.index).trimEnd(), suggestions };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'searchData',
    description: 'Zoekt in de interne bedrijfsdata (skills, opleidingen, software, taken) en marktsamenvattingen op trefwoorden. Geeft records met hun ref terug.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'readSource',
    description: 'Leest één bedrijfsdata-record volledig op basis van zijn ref (bv. "mt1").',
    input_schema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
  },
  {
    name: 'vacancyTrend',
    description: 'Telt per jaar hoeveel echte vacatures een van de zoektermen noemen (in titel of beschrijving) en welk aandeel (%) van alle vacatures dat is. Gebruik dit om te zien of de vraag naar een skill groeit.',
    input_schema: {
      type: 'object',
      properties: { terms: { type: 'array', items: { type: 'string' }, description: 'Synoniemen van één skill, max 8' } },
      required: ['terms'],
    },
  },
  {
    name: 'searchVacancies',
    description: 'Geeft de recentste echte vacatures die een van de zoektermen noemen, met id, titel, bedrijf, datum, land en een fragment. Gebruik ze als bewijs en voorbeeld van functietitels.',
    input_schema: {
      type: 'object',
      properties: {
        terms: { type: 'array', items: { type: 'string' } },
        limit: { type: 'integer', description: '1-10, standaard 5' },
      },
      required: ['terms'],
    },
  },
  {
    name: 'search_postings',
    description: 'Zoekt echte vacatures op betekenis in plaats van trefwoorden, over Engels, Nederlands en Frans heen. Geeft vacancy_id, titel, bedrijf, land, datum en een fragment terug. Gebruik ze als bewijs en voorbeeld en verwijs naar de vacancy_id (bv. in basedOn). Niet om te tellen: daarvoor is top_skills.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        k: { type: 'integer', description: '1-50, standaard 8' },
        country: { type: 'string', enum: ['BE', 'NL', 'LU', 'GB'] },
        company: { type: 'string', description: 'Deel van de bedrijfsnaam' },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
      },
      required: ['query'],
    },
  },
  {
    name: 'top_skills',
    description: 'Telt de meest gevraagde ESCO-skills in alle vacatures die aan de filters voldoen: skill, aantal vacatures en aandeel, plus het totaal. Gebruik dit voor marktcijfers; een totaal onder ~50 is anekdotisch. Jan-apr 2026 is onvolledig.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Deel van de bedrijfsnaam, bv. "belfius"' },
        country: { type: 'string', enum: ['BE', 'NL', 'LU', 'GB'] },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        title_contains: { type: 'string', description: 'Deel van de functietitel, bv. "data scientist"' },
        k: { type: 'integer', description: '1-200, standaard 20' },
      },
    },
  },
  {
    name: 'searchKnowledge',
    description: 'Full-text zoeken (BM25, best passende eerst) in vacatures 2025-2026, ESCO-skills en AI-blootstelling per beroep. Geeft ref, soort, titel, fragment en score terug.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Zoekvraag in gewone woorden, bv. "prompt engineering" of "claims handler"' },
        kind: { type: 'string', enum: ['vacancy', 'skill', 'ai_exposure'], description: 'Optioneel: zoek in één soort' },
        limit: { type: 'integer', description: '1-20, standaard 8' },
      },
      required: ['query'],
    },
  },
  {
    name: 'skill_gap',
    description: 'Vergelijkt de skills die de markt vraagt in vergelijkbare rollen met de skills die aanwezig zijn bij het (synthetische) Goldman Stanley, per functie of functietitel. Geeft kloven en sterktes met marktaandeel, intern aandeel en een voorbeeldvacature als bewijs.',
    input_schema: {
      type: 'object',
      properties: {
        function: { type: 'string', description: 'Functie of jobfamilie, bv. "Risk" of "Customer Service"' },
        job_title: { type: 'string', description: 'Eén interne functietitel' },
        k: { type: 'integer', description: '1-100, standaard 15' },
      },
    },
  },
  {
    name: 'createVacancyDocument',
    description: 'Maakt een downloadbaar Word-document met vacatureteksten op maat van het bedrijf. Eén keer per antwoord, met alle vacatures.',
    input_schema: {
      type: 'object',
      properties: {
        vacancies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              department: { type: 'string' },
              intro: { type: 'string', description: '2-3 zinnen over de rol en waarom het bedrijf haar nu zoekt' },
              responsibilities: { type: 'array', items: { type: 'string' } },
              requirements: { type: 'array', items: { type: 'string' } },
              niceToHave: { type: 'array', items: { type: 'string' } },
              offer: { type: 'array', items: { type: 'string' } },
              basedOn: { type: 'array', items: { type: 'string' }, description: "Id's van echte vacatures uit search_postings of searchVacancies" },
              linkedinSearch: { type: 'string', description: 'Boolean-zoekstring om kandidaten op LinkedIn te vinden' },
              alternativeTitles: { type: 'array', items: { type: 'string' }, description: 'Andere functietitels om op te zoeken' },
            },
            required: ['title', 'department', 'intro', 'responsibilities', 'requirements', 'offer'],
          },
        },
      },
      required: ['vacancies'],
    },
  },
];

type ToolInput = {
  query?: string; ref?: string; terms?: string[]; limit?: number; kind?: Kind; vacancies?: VacancyDraft[];
  k?: number; country?: string; company?: string; year_from?: number; year_to?: number; function?: string; job_title?: string; title_contains?: string;
};

const clamp = (k: number | undefined, max: number) => (k === undefined ? undefined : Math.min(Math.max(1, k), max));

const RAG_DOWN = { message: 'RAG-API niet bereikbaar; gebruik searchVacancies en vacancyTrend.' };

/** Calls the data team's RAG API (via SSH tunnel). Never throws, so the agent keeps working without it. */
async function ragApi(path: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${process.env.RAG_API_URL ?? 'http://localhost:8100'}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status >= 400 && res.status < 500) return { error: `RAG-API weigerde de invoer (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}` };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return RAG_DOWN;
  }
}

export async function runTool(name: string, input: ToolInput, documents: ProposedVacancies[]): Promise<unknown> {
  if (name === 'createVacancyDocument') {
    const vacancies = input.vacancies ?? [];
    const documentId = await saveVacancyDocument(data.company.name, vacancies);
    documents.push({ documentId, vacancies });
    return { message: `Document gemaakt met ${input.vacancies!.length} vacature(s). De downloadlink wordt automatisch toegevoegd.` };
  }
  if (name === 'searchData') {
    const hits = search(input.query ?? '');
    return hits.length ? hits : { message: 'Geen resultaten. Probeer andere trefwoorden.' };
  }
  if (name === 'readSource') return byRef(input.ref ?? '') ?? { message: `Geen record "${input.ref}".` };
  if (name === 'vacancyTrend') return vacancyTrend(input.terms ?? []);
  if (name === 'searchVacancies') return searchVacancies(input.terms ?? [], input.limit);
  if (name === 'search_postings') {
    const { query, k, country, company, year_from, year_to } = input;
    const hits = await ragApi('/search_postings', { query, k: clamp(k, 50), country, company, year_from, year_to });
    if (hits === RAG_DOWN) {
      // Keyword fallback: the longer words of the query as search terms.
      const terms = (query ?? '').split(/\s+/).filter((w) => w.length > 3).slice(0, 8);
      try {
        return await searchVacancies(terms.length ? terms : [query ?? ''], Math.min(k ?? 5, 10));
      } catch {
        return { message: 'RAG-API en vacaturedatabase niet bereikbaar; antwoord zonder vacaturebewijs en zeg dat.' };
      }
    }
    return Array.isArray(hits) ? hits.map((h) => ({ ...h, text: String(h.text ?? '').slice(0, 600) })) : hits;
  }
  if (name === 'top_skills') {
    const { company, country, year_from, year_to, title_contains, k } = input;
    return ragApi('/top_skills', { company, country, year_from, year_to, title_contains, k: clamp(k, 200) });
  }
  if (name === 'skill_gap') return ragApi('/skill_gap', { function: input.function, job_title: input.job_title, k: clamp(input.k, 100) });
  if (name === 'searchKnowledge') return searchKnowledge(input.query ?? '', input.kind, input.limit);
  return { message: `Onbekende tool ${name}` };
}

const MAX_STEPS = 12;

/** Manual tool-use loop against the Claude Messages API. */
export async function answer(
  history: ChatMessage[],
): Promise<{ content: string; proposed: ProposedVacancies[]; suggestions?: string[] }> {
  const { AI_API_KEY, AI_MODEL } = process.env;
  if (!AI_API_KEY || !AI_MODEL) throw new Error('Zet AI_API_KEY en AI_MODEL in .env');
  const client = new Anthropic({ apiKey: AI_API_KEY });

  const messages: Anthropic.MessageParam[] = [...history];
  const documents: ProposedVacancies[] = [];
  // The link is added here, not by the model, so it can never point to a document that doesn't exist.
  // Safety net: strip internal refs like [mt1] or [is2, is5] in case the model still writes them.
  const withLinks = (reply: string) => {
    const { content: text, suggestions } = splitSuggestions(reply);
    return {
      content: text.replace(/ ?\[[a-z]{2}\d+(?:\s*,\s*[a-z]{2}\d+)*\](?!\()/g, '') + documents.map((d) => `\n\n**[Download vacatures (Word)](/api/documents/${d.documentId})**`).join(''),
      proposed: documents,
      suggestions,
    };
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({ model: AI_MODEL, max_tokens: 16000, system: SYSTEM, tools: TOOLS, messages });
    messages.push({ role: 'assistant', content: response.content });

    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    if (response.stop_reason === 'refusal') return { content: 'Ik kan deze vraag niet beantwoorden.', proposed: [] };
    if (response.stop_reason === 'max_tokens') return withLinks(`${text}\n\n_(Antwoord afgekapt: te lang.)_`);
    if (response.stop_reason !== 'tool_use') return withLinks(text);

    const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
        try {
          const result = await runTool(call.name, call.input as ToolInput, documents);
          return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) };
        } catch (err) {
          return { type: 'tool_result', tool_use_id: call.id, content: (err as Error).message, is_error: true };
        }
      }),
    );
    messages.push({ role: 'user', content: results });
  }
  return { content: 'Ik kon de vraag niet afronden binnen het aantal stappen. Probeer een specifiekere vraag.', proposed: [] };
}
