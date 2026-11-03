import type { AnalyzeResponse, Evidence, Readiness } from '../types'

const evidence: Evidence[] = [
  { id: 'ev-ins-vac-1', sourceType: 'vacancy', synthetic: true,
    title: 'Gesimuleerde vacature: Schadebehandelaar Digitaal',
    excerpt: 'Je behandelt schadedossiers met hulp van AI-tools die documenten samenvatten. Je controleert de voorstellen kritisch.' },
  { id: 'ev-ins-vac-2', sourceType: 'vacancy', synthetic: true,
    title: 'Gesimuleerde vacature: Actuaris Pricing',
    excerpt: 'Je bouwt tariefmodellen met Python en machine learning en documenteert ze voor de toezichthouder.' },
  { id: 'ev-ins-int-1', sourceType: 'internal', synthetic: true,
    title: 'Gesimuleerde interne gegevens: vaardighedenprofielen',
    excerpt: 'Gesimuleerde interne gegevens: in Schadebeheer vermeldt 8% van de profielen ervaring met AI-tools; in Actuariaat 46% Python.' },
  { id: 'ev-ins-der-1', sourceType: 'derived', synthetic: true,
    title: 'Afgeleid: vraag naar AI-vaardigheden in vacatures',
    excerpt: 'In 2026 vraagt 27% van de vergelijkbare verzekeringsvacatures naar minstens één AI-vaardigheid (gesimuleerd).' },
]

export const emptyReadiness: Readiness = {
  companyId: 'demo-empty',
  companyName: 'Verzekeraar Noord (demo)',
  synthetic: true,
  period: { from: '2026-01-01', to: '2026-06-30', comparisonFrom: '2025-01-01', comparisonTo: '2025-06-30' },
  scores: [
    { dimension: 'skills', value: 34, coverage: 0.7, trend: 6,
      explanation: 'Gewogen interne dekking van 4 AI-vaardigheden, naar hun aandeel in vergelijkbare vacatures (gesimuleerd).',
      evidenceIds: ['ev-ins-int-1', 'ev-ins-der-1'] },
    { dimension: 'ai_usage', value: 41, coverage: 0.6, trend: 9,
      explanation: 'AI-tools gebruikt in de afgelopen 90 dagen door 148 van 360 medewerkers in 3 van 4 afdelingen (gesimuleerd).',
      evidenceIds: ['ev-ins-der-1'] },
    { dimension: 'training', value: 12, coverage: 0.9, trend: 3,
      explanation: 'Medewerkers met een afgeronde opleiding op een tekortvaardigheid van hun afdeling: 43 van 360 (gesimuleerd).',
      evidenceIds: ['ev-ins-int-1'] },
  ],
  skillGaps: [
    { skillId: 'ai-claims', name: 'AI bij schadebehandeling', department: 'Schadebeheer', marketShare: 0.31, internalCoverage: 0.08,
      explanation: 'Vraag in vergelijkbare vacatures: 31%; intern aanwezig bij 8% van de profielen (gesimuleerd).',
      evidenceIds: ['ev-ins-vac-1', 'ev-ins-int-1'] },
    { skillId: 'ml-pricing', name: 'Machine learning voor pricing', department: 'Actuariaat', marketShare: 0.38, internalCoverage: 0.22,
      explanation: 'Vraag in vergelijkbare vacatures: 38%; intern aanwezig bij 22% van de profielen (gesimuleerd).',
      evidenceIds: ['ev-ins-vac-2', 'ev-ins-int-1'] },
    { skillId: 'python-data', name: 'Python voor data-analyse', department: 'Actuariaat', marketShare: 0.44, internalCoverage: 0.46,
      explanation: 'Vraag in vergelijkbare vacatures: 44%; intern aanwezig bij 46% van de profielen (gesimuleerd).',
      evidenceIds: ['ev-ins-vac-2', 'ev-ins-int-1'] },
    { skillId: 'ai-act', name: 'AI Act-compliance', department: 'Compliance', marketShare: 0.19, internalCoverage: 0.1,
      explanation: 'Vraag in vergelijkbare vacatures: 19%; intern aanwezig bij 10% van de profielen (gesimuleerd).',
      evidenceIds: ['ev-ins-der-1'] },
  ],
  softwareGaps: [
    { id: 'sw-ins-claims', department: 'Schadebeheer', need: 'Schadedossiers sneller afhandelen',
      currentTool: 'Dossiersysteem zonder AI-functies', aiStatus: 'geen',
      suggestion: 'Documentsamenvatting met bronvermelding in het dossiersysteem' },
    { id: 'sw-ins-compliance', department: 'Compliance', need: 'AI Act-compliance',
      currentTool: 'Excel-register', aiStatus: 'geen',
      suggestion: 'Register voor AI-toepassingen met risicoclassificatie' },
  ],
  evidence,
}

export const emptyAnalyze: AnalyzeResponse = {
  companyId: 'demo-empty',
  summary: 'Verzekeraar Noord heeft de grootste AI-tekorten in Schadebeheer en Actuariaat. Twee gerichte acties met een afgebakende pilot pakken die eerst aan.',
  actions: [
    { id: 'act-1', rank: 1, type: 'training', department: 'Schadebeheer',
      title: 'Opleiding AI-ondersteunde schadebehandeling',
      bullets: [
        'Waarom: 31% van de vergelijkbare vacatures vraagt AI bij schadebehandeling, intern is dat 8%.',
        'Train behandelaars om AI-samenvattingen van dossiers kritisch te controleren.',
        'Werk met geanonimiseerde dossiers als oefencasus.',
      ],
      pilot: '10 schadebehandelaars, 6 weken, enkel autoschade.',
      successMetric: 'Afhandeltijd per dossier daalt met 15% bij gelijke kwaliteit.',
      evidenceIds: ['ev-ins-vac-1', 'ev-ins-int-1'] },
    { id: 'act-2', rank: 2, type: 'software', department: 'Compliance',
      title: 'AI-register met risicoclassificatie',
      bullets: [
        'Waarom: de AI Act vraagt een overzicht van AI-toepassingen; intern staat dat in een Excel-register.',
        'Leg alle AI-toepassingen vast met een risicoklasse en een eigenaar.',
      ],
      pilot: 'Compliance en IT, 6 weken, de 8 meest gebruikte AI-toepassingen.',
      successMetric: '100% van de 8 pilottoepassingen heeft een risicoklasse en een eigenaar.',
      evidenceIds: ['ev-ins-der-1'] },
  ],
  limitations: [
    'Alle gegevens in deze demo zijn gesimuleerd.',
    'Vacatures zijn een indicatie van marktvraag, geen bewijs van wat bedrijven werkelijk nodig hebben.',
  ],
  mode: 'demo',
}
