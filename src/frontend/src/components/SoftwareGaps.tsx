import type { SoftwareGap } from '../types'
import { EmptyState } from './StateMessages'

export function SoftwareGaps({ gaps }: { gaps: SoftwareGap[] }) {
  const byDept = new Map<string, SoftwareGap[]>()
  for (const g of gaps) byDept.set(g.department, [...(byDept.get(g.department) ?? []), g])

  return (
    <section aria-labelledby="softwaregaps-h" className="space-y-4">
      <h2 id="softwaregaps-h" className="text-title text-foreground">Ontbrekende software per afdeling</h2>
      {gaps.length === 0 && <EmptyState title="Geen ontbrekende software gevonden" />}
      {[...byDept].map(([dept, items]) => (
        <div key={dept} className="rounded-lg border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 text-heading text-foreground">{dept}</h3>
          <ul className="divide-y divide-border">
            {items.map((g) => (
              <li key={g.id} className="px-4 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-heading text-foreground">{g.need}</span>
                  <span className="text-body-sm text-muted-foreground">
                    Nu: {g.currentTool} · AI: {g.aiStatus}
                  </span>
                </span>
                <span className="mt-1 block text-body-sm text-muted-foreground">Voorstel: {g.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
