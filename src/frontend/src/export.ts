import type { Readiness, ScoreDimension } from './types'

export type ReportData = {
  organisation: string
  period: string
  scores: { label: string; value: number | null; coverage: number | null }[]
  skillGaps: { name: string; department: string; marketShare: number | null; internalCoverage: number | null }[]
  softwareGaps: { department: string; need: string; currentTool: string; suggestion: string }[]
  simulated: boolean
}

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  skills: 'Skills',
  ai_usage: 'AI-gebruik',
  training: 'Training',
}

/** Maps the dashboard data (types.ts Readiness) to the report shape. Unknown values stay null. */
export function toReportData(readiness: Readiness): ReportData {
  const { period } = readiness
  return {
    organisation: readiness.companyName,
    period: `${period.from} t/m ${period.to}`,
    scores: readiness.scores.map((s) => ({
      label: DIMENSION_LABELS[s.dimension],
      value: s.value,
      coverage: s.coverage,
    })),
    skillGaps: readiness.skillGaps.map((g) => ({
      name: g.name,
      department: g.department,
      marketShare: g.marketShare,
      internalCoverage: g.internalCoverage,
    })),
    softwareGaps: readiness.softwareGaps.map((g) => ({
      department: g.department,
      need: g.need,
      currentTool: g.currentTool,
      suggestion: g.suggestion,
    })),
    simulated: readiness.synthetic,
  }
}

function percent(value: number | null): string {
  return value === null ? 'onbekend' : `${Math.round(value * 100)}%`
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

export function buildReportMarkdown(report: ReportData): string {
  const lines: string[] = []
  lines.push('# Json AI-readiness rapport', '')
  lines.push(`**Organisatie:** ${report.organisation}  `)
  lines.push(`**Periode:** ${report.period}`, '')
  if (report.simulated) {
    lines.push('> Gesimuleerde demogegevens', '')
  }

  lines.push('## Scores', '')
  if (report.scores.length === 0) {
    lines.push('Geen scores beschikbaar.', '')
  } else {
    lines.push('| Dimensie | Score (0-100) | Dekking |', '| --- | --- | --- |')
    for (const s of report.scores) {
      const value = s.value === null ? 'onbekend' : String(s.value)
      lines.push(`| ${cell(s.label)} | ${value} | ${percent(s.coverage)} |`)
    }
    lines.push('')
  }

  lines.push('## Skill-gaps', '')
  if (report.skillGaps.length === 0) {
    lines.push('Geen skill-gaps gevonden.', '')
  } else {
    lines.push('| Skill | Afdeling | Marktaandeel vacatures | Interne dekking |', '| --- | --- | --- | --- |')
    for (const g of report.skillGaps) {
      lines.push(
        `| ${cell(g.name)} | ${cell(g.department)} | ${percent(g.marketShare)} | ${percent(g.internalCoverage)} |`,
      )
    }
    lines.push('')
  }

  lines.push('## Software-gaps', '')
  if (report.softwareGaps.length === 0) {
    lines.push('Geen software-gaps gevonden.', '')
  } else {
    for (const g of report.softwareGaps) {
      lines.push(
        `- **${cell(g.department)}:** ${cell(g.need)}. Huidig: ${cell(g.currentTool)}. Voorstel: ${cell(g.suggestion)}.`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function exportReport(report: ReportData): void {
  const blob = new Blob([buildReportMarkdown(report)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'json-ai-readiness-rapport.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
