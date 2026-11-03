// Deterministische overzicht voor GET /api/overview (zijbalk naast de chat). Geen LLM-aanroep.
// Velden die niet uit de data te berekenen zijn, staan op null (zie commentaar per veld).
import { readFileSync } from 'node:fs'
import { readinessFor } from './readiness.mjs'

const bank = JSON.parse(readFileSync(new URL('./mock/internal-bank.json', import.meta.url), 'utf8'))
const sum = (xs) => xs.reduce((a, x) => a + x, 0)
const coveragePct = (c) => `${Math.round(c * 100)}%`

// readiness is optional; tests pass a modified copy to exercise null scores.
export function overviewFor(companyId, readiness = readinessFor(companyId)) {
  const r = readiness
  if (!r) return { status: 404, body: { error: 'Onbekend bedrijf.' } }

  const body = {
    // Sector en medewerkersaantal komen uit de interne data (som van de afdelingsheadcounts).
    company: {
      name: r.companyName,
      sector: bank.company.industry,
      employees: sum(bank.departments.map((d) => d.headcount)),
    },
    // Null-score blijft null (onbekend, nooit 0). Dekking is een fractie, hier als percentage.
    scores: r.scores.map((s) => ({
      dimension: s.dimension,
      value: s.value,
      explanation: s.explanation,
      coverage: coveragePct(s.coverage),
    })),
    // growthPct: null. De data bevat een aandeel van vacatures, geen groeipercentage per jaar.
    // internalPeople: null als het aantal medewerkers met de skill niet gemeten is (data-governance).
    gaps: r.skillGaps.map((g) => {
      const inv = bank.skills_inventory.find((s) => s.skillId === g.skillId)
      return {
        skill: g.name,
        growthPct: null,
        internalPeople: inv?.employees_with_skill ?? null,
        ref: g.skillId,
      }
    }),
    // repetitiveHoursPerWeek: null. Er is geen data over repetitief werk in de bronnen.
    software: r.softwareGaps.map((s) => ({
      name: s.currentTool,
      usedBy: s.department,
      aiFeatures: s.aiStatus,
      repetitiveHoursPerWeek: null,
      ref: s.id,
    })),
    // Label per bronverwijzing: de evidence-id's uit de readiness-data, met hun titel.
    refs: Object.fromEntries(r.evidence.map((e) => [e.id, e.title])),
    synthetic: r.synthetic,
  }
  return { status: 200, body }
}

// Framework-neutrale router. Geeft null als het pad niet bij deze route hoort.
export function overviewHandle(method, url) {
  if (method !== 'GET') return null
  const { pathname, searchParams } = new URL(url, 'http://localhost')
  if (pathname !== '/api/overview') return null
  return overviewFor(searchParams.get('companyId') ?? 'demo-bank')
}
