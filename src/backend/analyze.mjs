// Deterministische analyse voor POST /api/analyze. Geen LLM-aanroep: alle acties komen uit de readiness-cijfers.
// Het veld `question` wordt geaccepteerd maar genegeerd, omdat er geen LLM wordt aangeroepen.
import { readinessFor } from './readiness.mjs'

const MAX_ACTIONS = 3
const LIMITATIONS = [
  'Gebaseerd op gesimuleerde interne gegevens.',
  'Marktcijfers zijn trefwoordtellingen, geen bewezen skills.',
]

const pct = (x) => Math.round(x * 100)
// Null marketShare sorteert als laatste (-1 is lager dan elke echte waarde).
const marketDesc = (a, b) => (b.marketShare ?? -1) - (a.marketShare ?? -1)
const joinNl = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} en ${xs[xs.length - 1]}`)

export function analyzeFor(companyId) {
  const r = readinessFor(companyId)
  if (!r) return { status: 404, body: { error: 'Onbekend bedrijf.' } }

  const knownEvidence = new Set(r.evidence.map((e) => e.id))
  const keepEvidence = (ids) => ids.filter((id) => knownEvidence.has(id))
  const scoreOf = (dimension) => r.scores.find((s) => s.dimension === dimension)

  const trainingGaps = r.skillGaps
    .filter((g) => g.internalCoverage !== null && g.internalCoverage < 0.5)
    .sort(marketDesc)
    .slice(0, 2)
  const measuredGaps = r.skillGaps.filter((g) => g.internalCoverage !== null)
  const lowestGap = measuredGaps.reduce((best, g) => (best === null || g.internalCoverage < best.internalCoverage ? g : best), null)
  const unmeasuredGap = r.skillGaps.find((g) => g.internalCoverage === null)
  const aiUsage = scoreOf('ai_usage')
  const skills = scoreOf('skills')

  const actions = []
  for (const g of trainingGaps) {
    actions.push({
      type: 'training',
      title: `Intern opleiden: ${g.name}`,
      department: g.department,
      bullets: [g.explanation, `Afdeling: ${g.department}`, 'Start met een pilot van 8 weken met één team.', 'Meet het aantal teamleden met de skill.'],
      pilot: 'Pilot van 8 weken met één team.',
      successMetric: 'Aantal teamleden met de skill, gemeten voor en na de pilot.',
      evidenceIds: keepEvidence(g.evidenceIds),
    })
  }
  if (aiUsage.value !== null && aiUsage.value < 50) {
    actions.push({
      type: 'software',
      title: 'Bestaande AI-tools inzetten',
      department: lowestGap?.department ?? 'Klantendienst',
      bullets: [aiUsage.explanation, `Afdeling: ${lowestGap?.department ?? 'Klantendienst'}`],
      pilot: 'Pilot van 6 weken met één team.',
      successMetric: 'Percentage teamleden dat de bestaande AI-tool wekelijks gebruikt.',
      evidenceIds: keepEvidence(lowestGap?.evidenceIds ?? []),
    })
  }
  if (unmeasuredGap) {
    actions.push({
      type: 'internal_tool',
      title: `Meten: ${unmeasuredGap.name} eerst in kaart brengen met een interne tool`,
      department: unmeasuredGap.department,
      bullets: [unmeasuredGap.explanation, `Afdeling: ${unmeasuredGap.department}`],
      pilot: 'Pilot van 4 weken bij één team.',
      successMetric: 'Percentage teamleden dat de skill heeft gemeten.',
      evidenceIds: keepEvidence(unmeasuredGap.evidenceIds),
    })
  }

  const kept = actions.slice(0, MAX_ACTIONS).map((a, i) => ({ id: `act-${i + 1}`, rank: i + 1, ...a }))

  const skillsText = skills.value === null ? 'onbekend' : `${skills.value}/100`
  const gapDepartments = [...new Set(trainingGaps.map((g) => g.department))]
  const gapText = gapDepartments.length
    ? `De grootste gaten staan bij ${joinNl(gapDepartments)}.`
    : 'Er zijn geen duidelijke gaten in de gemeten vaardigheden.'
  const summary = `Vaardigheden: ${skillsText} (datadekking ${pct(skills.coverage)}%). ${gapText} Gebaseerd op gesimuleerde gegevens.`

  return {
    status: 200,
    body: { companyId: r.companyId, summary, actions: kept, limitations: [...LIMITATIONS], mode: 'live' },
  }
}

// Framework-neutral route, zelfde patroon als chat.mjs: geeft null als het pad niet bij deze route hoort.
export async function analyzeHandle(method, url, readBody) {
  if (method !== 'POST' || url.split('?')[0] !== '/api/analyze') return null
  let body
  try {
    body = await readBody()
  } catch (err) {
    return { status: 400, body: { error: err.message } }
  }
  const companyId = body?.companyId
  if (typeof companyId !== 'string' || companyId.trim() === '') {
    return { status: 400, body: { error: 'companyId ontbreekt.' } }
  }
  return analyzeFor(companyId)
}

// POST /api/slack/preview: tekst van het Slack-bericht voor één actie. Er wordt niets verzonden.
export async function slackPreviewHandle(method, url, readBody) {
  if (method !== 'POST' || url.split('?')[0] !== '/api/slack/preview') return null
  let body
  try {
    body = await readBody()
  } catch (err) {
    return { status: 400, body: { error: err.message } }
  }
  const result = analyzeFor(body?.companyId)
  if (result.status !== 200) return result
  const action = result.body.actions.find((a) => a.id === body?.actionId)
  if (!action) return { status: 404, body: { error: 'Onbekende actie.' } }
  const text = [
    '*Voorbeeld, niet verzonden*',
    `*AI-readiness: voorgestelde actie voor ${readinessFor(body.companyId).companyName}*`,
    `*#${action.rank} ${action.title}* (${action.department})`,
    ...action.bullets.map((b) => `• ${b}`),
    `*Pilot:* ${action.pilot}`,
    `*Succesmaat:* ${action.successMetric}`,
    '_Gebaseerd op gesimuleerde gegevens._',
  ].join('\n')
  return { status: 200, body: { text } }
}
