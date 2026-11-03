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
            { type: 'metric', label: 'Skills-score', value: '58/100', note: 'Gesimuleerde gegevens' },
            { type: 'metric', label: 'Datadekking', value: '82%', note: 'Gesimuleerde gegevens' },
            { type: 'metric', label: 'Skill gaps', value: '6', note: 'Gesimuleerde gegevens' },
            {
              type: 'bar',
              title: 'Vraag naar skills in vacatures (% van vergelijkbare vacatures)',
              unit: '%',
              items: [
                { label: 'Python', value: 41 },
                { label: 'Modelmonitoring', value: 34 },
                { label: 'AI Act', value: 29 },
                { label: 'Prompt engineering', value: 22 },
                { label: 'Data governance', value: 18 },
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
