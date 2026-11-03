import type { AnalyzeResponse, Company, Readiness } from '../types'
import { bankAnalyze, bankReadiness } from './bank'
import { emptyAnalyze, emptyReadiness } from './empty'

export const demoCompanies: Company[] = [
  { id: 'demo-bank', name: 'Goldman Stanley', industry: 'Bankwezen', country: 'BE', synthetic: true },
  { id: 'demo-empty', name: 'Verzekeraar Noord (demo)', industry: 'Verzekeringen', country: 'BE', synthetic: true },
]

export const demoReadiness: Record<string, Readiness> = {
  'demo-bank': bankReadiness,
  'demo-empty': emptyReadiness,
}

export const demoAnalyze: Record<string, AnalyzeResponse> = {
  'demo-bank': bankAnalyze,
  'demo-empty': emptyAnalyze,
}

export function demoSlackPreview(companyId: string, actionId: string): string {
  const company = demoCompanies.find((c) => c.id === companyId)
  const action = demoAnalyze[companyId]?.actions.find((a) => a.id === actionId)
  if (!company || !action) return '_Demo: geen voorbeeldbericht beschikbaar voor deze actie._'
  return [
    '*Demo-voorbeeld, niet verzonden*',
    `*AI-readiness: voorgestelde actie voor ${company.name}*`,
    `*#${action.rank} ${action.title}* (${action.department})`,
    ...action.bullets.map((b) => `• ${b}`),
    `*Pilot:* ${action.pilot}`,
    `*Succesmaat:* ${action.successMetric}`,
    '_Gebaseerd op gesimuleerde gegevens._',
  ].join('\n')
}
