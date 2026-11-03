import { useState, type MouseEvent } from 'react'
import type { SkillGap } from '../types'
import { EmptyState } from './StateMessages'
import { VacancyDraft } from './VacancyDraft'
import { formatPercent } from '../format'

export function SkillGaps({
  gaps,
  onSelectEvidence,
}: {
  gaps: SkillGap[]
  evidenceCount?: number
  onSelectEvidence?: (evidenceIds: string[]) => void
}) {
  const [openDrafts, setOpenDrafts] = useState<Set<string>>(new Set())
  if (gaps.length === 0) return <EmptyState title="Geen skill gaps gevonden" />

  function toggleDraft(key: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    setOpenDrafts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const byDept = new Map<string, SkillGap[]>()
  for (const g of gaps) byDept.set(g.department, [...(byDept.get(g.department) ?? []), g])

  return (
    <section aria-labelledby="skillgaps-h" className="space-y-4">
      <h2 id="skillgaps-h" className="text-title text-foreground">Ontbrekende skills per afdeling</h2>
      {[...byDept].map(([dept, items]) => (
        <div key={dept} className="rounded-md border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 text-heading text-foreground">{dept}</h3>
          <ul className="divide-y divide-border">
            {items.map((g) => {
              const key = `${g.skillId}-${g.department}`
              const open = openDrafts.has(key)
              return (
                <li key={key}>
                  <div className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectEvidence?.(g.evidenceIds)}
                      className="block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className="text-heading text-foreground">{g.name}</span>
                        <span className="text-body-sm text-muted-foreground">
                          {g.marketShare === null ? 'Onbekend' : `${formatPercent(g.marketShare)} van vergelijkbare vacatures`}
                          {' · '}
                          {g.internalCoverage === null ? 'Intern: onbekend' : `Intern: ${formatPercent(g.internalCoverage)}`}
                        </span>
                      </span>
                      <span className="mt-1 block text-body-sm text-muted-foreground">{g.explanation}</span>
                    </button>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={(e) => toggleDraft(key, e)}
                      className="mt-2 rounded-md border border-border px-3 py-1 text-body-sm hover:bg-muted"
                    >
                      Maak vacature-concept
                    </button>
                  </div>
                  {open && (
                    <div className="px-4 pb-3">
                      <VacancyDraft gap={g} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
