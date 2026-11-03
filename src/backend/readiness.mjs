// Readiness-contract voor het gesimuleerde bedrijf (demo zonder fixtures).
// Alle getallen zijn deterministisch uit src/backend/mock/internal-bank.json.
//
// Formules (coverage wordt afgerond op 2 decimalen):
// - skills: over vaardigheden met internal_coverage != null:
//     value = round(100 * sum(marketShare*coverage) / sum(marketShare)); null als er geen zijn.
//     coverage = aantal met coverage != null / aantal vaardigheden.
// - ai_usage: afdelingen met employees_with_ai_tool_use_90d != null:
//     value = round(100 * sum(employees) / sum(headcount)); null als minder dan 3 van de 5 afdelingen gemeten zijn.
//     coverage = sum(headcount gemeten) / sum(headcount alle afdelingen).
// - training: afdelingen met een tekortvaardigheid. Per afdeling tellen we distinct employee_anon_id met minstens
//     een opleiding waarvan skill_id een tekortvaardigheid van diezelfde afdeling is (skill_id null telt niet).
//     value = round(100 * totaal geteld / totaal headcount van die afdelingen); coverage = 1 als training_records niet leeg is, anders 0.
// - marketShare komt uit data/skill_signal.json (share_2025 per skillId; de mock bevat dat niet).
// - ev-missing-1 blijft alleen bij data-governance staan (de enige vaardigheid zonder interne dekking), zoals in de fixture.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bank = JSON.parse(readFileSync(new URL('./mock/internal-bank.json', import.meta.url), 'utf8'))

const SIGNAL_FILE = fileURLToPath(new URL('../../data/skill_signal.json', import.meta.url))

// Marktaandeel per skillId: share_2025 uit data/skill_signal.json (semantische match op de GPU-embeddings).
// Ontbreekt het bestand of een skill, dan is het null; zo'n vaardigheid telt niet mee in de vaardighedenscore.
export function loadMarketShares(file = SIGNAL_FILE) {
  if (!existsSync(file)) return {}
  const signal = JSON.parse(readFileSync(file, 'utf8'))
  return Object.fromEntries((signal.skills ?? []).map((s) => [s.skillId, s.share_2025 ?? null]))
}

const MARKET_SHARE = loadMarketShares()

const SOFTWARE_GAPS = [
  { id: 'sw-risk', department: 'Risk', need: 'Modelmonitoring',
    currentTool: 'Handmatige Excel-rapportages', aiStatus: 'geen',
    suggestion: 'Monitoringplatform voor modellen met automatische drift-meldingen' },
  { id: 'sw-compliance', department: 'Compliance', need: 'AI Act-compliance',
    currentTool: 'SharePoint-lijsten', aiStatus: 'geen',
    suggestion: 'Register voor AI-toepassingen met risicoclassificatie' },
  { id: 'sw-finance', department: 'Finance & Control', need: 'Maandrapportages automatiseren',
    currentTool: 'Excel', aiStatus: 'geen',
    suggestion: 'Rapportage-automatisering met AI-toelichting bij afwijkingen' },
  { id: 'sw-klant', department: 'Klantendienst', need: 'Klantvragen sneller beantwoorden',
    currentTool: 'CRM zonder AI-functies', aiStatus: 'geen',
    suggestion: 'AI-assistent in het CRM die antwoorden met bronvermelding voorstelt' },
]

const sum = (xs) => xs.reduce((a, x) => a + x, 0)
const pct = (x) => Math.round(x * 100)
const pctDec = (x) => (Math.round(x * 10000) / 100).toFixed(2).replace('.', ',')
const round2 = (x) => Math.round(x * 100) / 100
const deptId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function readinessFor(companyId, marketShare = MARKET_SHARE) {
  if (companyId !== bank.company.id) return null
  const { departments, skills_inventory: skills, training_records: training } = bank
  const internalIds = (ds) => ds.map((d) => `ev-int-${deptId(d.name)}`)

  // skills
  const measuredSkills = skills.filter((s) => s.internal_coverage !== null)
  const weighted = measuredSkills.filter((s) => marketShare[s.skillId] != null)
  const skillDen = sum(weighted.map((s) => marketShare[s.skillId]))
  const skillNum = sum(weighted.map((s) => marketShare[s.skillId] * s.internal_coverage))
  const skillsValue = weighted.length ? Math.round((100 * skillNum) / skillDen) : null
  const skillsCoverage = round2(measuredSkills.length / skills.length)
  const skillsExplanation = skillsValue === null
    ? 'Onvoldoende interne gegevens om de vaardighedenscore te berekenen (gesimuleerd).'
    : `Gewogen interne dekking van ${weighted.length} van de ${skills.length} AI-vaardigheden, naar hun marktaandeel (marktaandeel = aandeel van vacatures 2025 met een semantische match (drempel 0,85), gemeten op een steekproef van de GPU-embeddings); de interne dekking is gesimuleerd.`

  // ai_usage
  const measuredDepts = departments.filter((d) => d.employees_with_ai_tool_use_90d !== null)
  const hcAll = sum(departments.map((d) => d.headcount))
  const hcMeasured = sum(measuredDepts.map((d) => d.headcount))
  const aiEmployees = sum(measuredDepts.map((d) => d.employees_with_ai_tool_use_90d))
  const aiValue = measuredDepts.length >= 3 ? Math.round((100 * aiEmployees) / hcMeasured) : null
  const aiCoverage = round2(hcMeasured / hcAll)
  const aiExplanation = aiValue === null
    ? 'Te weinig afdelingen met een meting van AI-tool-gebruik om een score te berekenen (gesimuleerd).'
    : `AI-tools gebruikt in de afgelopen 90 dagen door ${aiEmployees} van ${hcMeasured} medewerkers in ${measuredDepts.length} van ${departments.length} afdelingen (gesimuleerd).`

  // training
  const gapDepts = departments.filter((d) => skills.some((s) => s.department === d.name))
  const trained = sum(gapDepts.map((d) => {
    const gapIds = new Set(skills.filter((s) => s.department === d.name).map((s) => s.skillId))
    const people = new Set(
      training
        .filter((t) => t.department === d.name && t.skill_id !== null && gapIds.has(t.skill_id))
        .map((t) => t.employee_anon_id),
    )
    return people.size
  }))
  const gapHeadcount = sum(gapDepts.map((d) => d.headcount))
  const trainingValue = Math.round((100 * trained) / gapHeadcount)
  const trainingCoverage = training.length > 0 ? 1 : 0
  const trainingExplanation = `Medewerkers met een afgeronde opleiding op een tekortvaardigheid van hun afdeling: ${trained} van ${gapHeadcount} (gesimuleerd).`

  const scores = [
    { dimension: 'skills', value: skillsValue, coverage: skillsCoverage, explanation: skillsExplanation,
      evidenceIds: ['ev-der-skills', ...internalIds(gapDepts)] },
    { dimension: 'ai_usage', value: aiValue, coverage: aiCoverage, explanation: aiExplanation,
      evidenceIds: ['ev-der-ai-usage', ...internalIds(measuredDepts)] },
    { dimension: 'training', value: trainingValue, coverage: trainingCoverage, explanation: trainingExplanation,
      evidenceIds: ['ev-der-training', ...internalIds(gapDepts)] },
  ]

  const skillGaps = skills.map((s) => {
    const ms = marketShare[s.skillId] ?? null
    const demand = ms === null ? 'onbekend (geen semantische match in de steekproef)' : `${pctDec(ms)}%`
    const explanation = s.internal_coverage === null
      ? `Marktaandeel (semantische match in vacatures 2025): ${demand}; interne dekking is onbekend omdat die niet is gemeten (gesimuleerd).`
      : `Marktaandeel (semantische match in vacatures 2025): ${demand}; intern aanwezig bij ${pct(s.internal_coverage)}% van de profielen (gesimuleerd).`
    return {
      skillId: s.skillId,
      name: s.name,
      department: s.department,
      marketShare: ms,
      internalCoverage: s.internal_coverage,
      explanation,
      evidenceIds: [
        `ev-int-${deptId(s.department)}`,
        ...(s.internal_coverage === null ? ['ev-missing-1'] : []),
      ],
    }
  })

  const evidence = [
    ...departments.map((d) => {
      const gaps = skills.filter((s) => s.department === d.name).map((s) => s.name)
      return {
        id: `ev-int-${deptId(d.name)}`,
        sourceType: 'internal',
        synthetic: true,
        title: `Gesimuleerde interne data: ${d.name}`,
        excerpt: `${d.headcount} medewerkers. AI-tool-gebruik in 90 dagen: ${d.employees_with_ai_tool_use_90d ?? 'niet gelogd'}. Tekortvaardigheden: ${gaps.join(', ') || 'geen'}.`,
      }
    }),
    { id: 'ev-der-skills', sourceType: 'derived', synthetic: true,
      title: 'Afgeleid: score vaardigheden', excerpt: skillsExplanation },
    { id: 'ev-der-ai-usage', sourceType: 'derived', synthetic: true,
      title: 'Afgeleid: score AI-gebruik', excerpt: aiExplanation },
    { id: 'ev-der-training', sourceType: 'derived', synthetic: true,
      title: 'Afgeleid: score opleidingen', excerpt: trainingExplanation },
  ]

  return {
    companyId: bank.company.id,
    companyName: bank.company.name,
    synthetic: true,
    period: bank.period,
    scores,
    skillGaps,
    softwareGaps: SOFTWARE_GAPS,
    evidence,
  }
}

// Framework-neutral router voor de bedrijfsroutes. Geeft null als het pad niet bij deze routes hoort.
export function readinessHandle(method, url) {
  if (method !== 'GET') return null
  const path = url.split('?')[0]
  if (path === '/api/companies') {
    const { id, name, industry, country } = bank.company
    return { status: 200, body: { companies: [{ id, name, industry, country, synthetic: true }] } }
  }
  const match = /^\/api\/companies\/([^/]+)\/readiness$/.exec(path)
  if (!match) return null
  const readiness = readinessFor(match[1])
  return readiness
    ? { status: 200, body: readiness }
    : { status: 404, body: { error: 'Onbekend bedrijf.' } }
}
