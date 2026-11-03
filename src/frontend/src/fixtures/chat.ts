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
