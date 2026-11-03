import type { ChatMessage, ChatResponse } from '../types'

export function demoChatReply(messages: ChatMessage[]): ChatResponse {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() ?? ''
  if (/dashboard|grafiek|overzicht/.test(last)) {
    return {
      mode: 'demo',
      message: {
        role: 'assistant',
        content: '[Demo] Hier is een kort dashboard voor Goldman Stanley, op basis van gesimuleerde gegevens.',
        suggestions: ['Welke skills missen we het meest bij Goldman Stanley?', 'Hoe staat Goldman Stanley er voor op AI-gebruik?', 'Wat moet HR als eerste doen?'],
        dashboard: {
          title: 'Goldman Stanley (gesimuleerd)',
          widgets: [
            { type: 'metric', label: 'Skills-score', value: '17/100', note: 'Gesimuleerde gegevens' },
            { type: 'metric', label: 'Datadekking', value: '83%', note: 'Gesimuleerde gegevens' },
            { type: 'metric', label: 'Skill gaps', value: '6', note: 'Gesimuleerde gegevens' },
            {
              type: 'bar',
              title: 'Vacatures met dit trefwoord in 2025 (% van alle vacatures, trefwoordtelling)',
              unit: '%',
              items: [
                { label: 'Python', value: 7.9 },
                { label: 'SQL', value: 6.9 },
                { label: 'Cloud (AWS/Azure/GCP)', value: 6.6 },
                { label: 'Prompt engineering / LLM', value: 3.9 },
                { label: 'Data governance', value: 1.6 },
              ],
            },
          ],
        },
      },
    }
  }
  const normalised = last.trim().replace(/[?.]/g, '')
  const faq: { match: string; reply: string }[] = [
    { match: 'hoe staat goldman stanley er voor op ai-gebruik', reply: '[Demo] Goldman Stanley scoort 64/100 op AI-gebruik, met 76% datadekking. Dit is gesimuleerd.' },
    { match: 'welke skills missen we het meest bij goldman stanley', reply: '[Demo] De grootste gaps bij Goldman Stanley zijn prompt engineering / LLM-gebruik (intern bij 4% van de profielen) en modelmonitoring (intern bij 12%). Dit is gesimuleerd.' },
    { match: 'wat moet hr als eerste doen', reply: '[Demo] Begin met de skill-gap met het grootste verschil tussen markt en intern: stel een pilot van 8 weken op en zet de resultaten in het HR-kanaal na goedkeuring. Dit is een demo-antwoord op gesimuleerde gegevens.' },
    { match: 'welke vacatures vragen om ai-skills in 2025', reply: '[Demo] In de echte vacaturedata vragen in 2025 de meeste vacatures om Python (7,9%), SQL (6,9%) en cloud (6,6%); AI-regelgeving staat laag (0,06%). Trefwoordtellingen, geen bewezen skills.' },
    { match: 'hoeveel vacatures noemen python in 2025', reply: '[Demo] Python komt in 2025 in 7,9% van de vacatures voor (trefwoordtelling).' },
  ]
  const hit = faq.find((f) => normalised.includes(f.match))
  if (hit) {
    return { mode: 'demo', message: { role: 'assistant', content: hit.reply } }
  }
  return {
    mode: 'demo',
    message: {
      role: 'assistant',
      content:
        '[Demo] Ik kan dashboards maken over bedrijven en skills. Vraag bijvoorbeeld: maak een dashboard van Goldman Stanley.',
      suggestions: ['Maak een dashboard van Goldman Stanley', 'Welke skills missen we het meest bij Goldman Stanley?', 'Welke vacatures vragen om AI-skills in 2025?'],
    },
  }
}
