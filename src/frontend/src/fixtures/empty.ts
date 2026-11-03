import type { AnalyzeResponse, Readiness } from '../types'

export const emptyReadiness: Readiness = {
  companyId: 'demo-empty',
  companyName: 'Verzekeraar Leeg (demo)',
  synthetic: true,
  period: { from: '2026-01-01', to: '2026-06-30', comparisonFrom: '2025-01-01', comparisonTo: '2025-06-30' },
  scores: [
    { dimension: 'skills', value: null, coverage: 0.05, explanation: 'Te weinig vacatures gevonden om een score te berekenen.', evidenceIds: [] },
    { dimension: 'ai_usage', value: null, coverage: 0, explanation: 'Geen interne gegevens over AI-gebruik beschikbaar.', evidenceIds: [] },
    { dimension: 'training', value: null, coverage: 0, explanation: 'Geen opleidingsgegevens beschikbaar.', evidenceIds: [] },
  ],
  skillGaps: [],
  softwareGaps: [],
  evidence: [],
}

export const emptyAnalyze: AnalyzeResponse = {
  companyId: 'demo-empty',
  summary: 'Er zijn te weinig gegevens om betrouwbare acties voor te stellen.',
  actions: [],
  limitations: ['Geen vacature- of interne gegevens beschikbaar voor dit bedrijf.'],
  mode: 'demo',
}
