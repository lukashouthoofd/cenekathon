import { useState } from 'react'
import type { SkillGap } from '../types'
import { EmptyState } from './StateMessages'

const pct = (v: number) => `${Math.round(v * 100)}%`

export function SkillGaps({
  gaps,
  onSelectEvidence,
}: {
  gaps: SkillGap[]
  evidenceCount?: number
  onSelectEvidence?: (evidenceIds: string[]) => void
}) {
  const [noEvidenceFor, setNoEvidenceFor] = useState<string | null>(null)

  if (gaps.length === 0) return <EmptyState title="Geen skill gaps gevonden" />

  const byDept = new Map<string, SkillGap[]>()
  for (const g of gaps) byDept.set(g.department, [...(byDept.get(g.department) ?? []), g])

  return (
    <section aria-labelledby="skillgaps-h" className="space-y-4">
      <h2 id="skillgaps-h" className="text-title text-foreground">Ontbrekende skills per afdeling</h2>
      {[...byDept].map(([dept, items]) => (
        <div key={dept} className="rounded-lg border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 text-heading text-foreground">{dept}</h3>
          <ul className="divide-y divide-border">
            {items.map((g) => (
              <li key={`${g.skillId}-${g.department}`}>
                <button
                  type="button"
                  onClick={() => {
                    setNoEvidenceFor(g.evidenceIds.length === 0 ? `${g.skillId}-${g.department}` : null)
                    onSelectEvidence?.(g.evidenceIds)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-heading text-foreground">{g.name}</span>
                    <span className="text-body-sm text-muted-foreground">
                      {g.marketShare === null ? 'Onbekend' : `${pct(g.marketShare)} van vergelijkbare vacatures`}
                      {' · '}
                      {g.internalCoverage === null ? 'Intern: onbekend' : `Intern: ${pct(g.internalCoverage)}`}
                    </span>
                  </span>
                  <span className="mt-1 block text-body-sm text-muted-foreground">{g.explanation}</span>
                  {noEvidenceFor === `${g.skillId}-${g.department}` && (
                    <span role="status" className="mt-1 block text-body-sm text-caution-text">
                      Geen bewijs gekoppeld aan deze skill gap.
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
