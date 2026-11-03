import type { SkillGap } from '../types'
import { EmptyState } from './StateMessages'

const pct = (v: number) => `${Math.round(v * 100)}%`

export function SkillGaps({
  gaps,
}: {
  gaps: SkillGap[]
  evidenceCount?: number
}) {
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
                <div className="px-4 py-3">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-heading text-foreground">{g.name}</span>
                    <span className="text-body-sm text-muted-foreground">
                      {g.marketShare === null ? 'Onbekend' : `${pct(g.marketShare)} van vergelijkbare vacatures`}
                      {' · '}
                      {g.internalCoverage === null ? 'Intern: onbekend' : `Intern: ${pct(g.internalCoverage)}`}
                    </span>
                  </span>
                  <span className="mt-1 block text-body-sm text-muted-foreground">{g.explanation}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
