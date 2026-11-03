import type { ReactNode } from 'react'
import type { Dashboard, Readiness, SkillGap, SoftwareGap } from '../types'
import { formatNumber } from '../format'
import { BarList, type BarItem } from './BarList'
import { ScoreCards } from './ScoreCards'

/** Average gap per department (market share minus internal coverage), skipping skills without a measured internal coverage. */
export function skillGapsByDepartment(gaps: SkillGap[]): BarItem[] {
  const byDept = new Map<string, number[]>()
  for (const g of gaps) {
    if (g.marketShare === null || g.internalCoverage === null) continue
    byDept.set(g.department, [...(byDept.get(g.department) ?? []), Math.max(0, g.marketShare - g.internalCoverage)])
  }
  return [...byDept]
    .map(([label, values]) => ({
      label,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
      colour: 'accent' as const,
    }))
    .sort((a, b) => b.value - a.value)
}

/** Share of the software gaps per department. */
export function softwareGapsByDepartment(gaps: SoftwareGap[]): BarItem[] {
  if (gaps.length === 0) return []
  const counts = new Map<string, number>()
  for (const g of gaps) counts.set(g.department, (counts.get(g.department) ?? 0) + 1)
  return [...counts]
    .map(([label, n]) => ({ label, value: n / gaps.length, colour: 'tertiary' as const }))
    .sort((a, b) => b.value - a.value)
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-heading text-foreground">{title}</h3>
      <p className="mt-0.5 text-caption text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Readiness overview: three KPI cards and two summary panels. */
export function ReadinessDashboard({ readiness }: { readiness: Readiness }) {
  return (
    <div className="space-y-4">
      <ScoreCards scores={readiness.scores} />
      <div className="grid gap-4 min-[900px]:grid-cols-2">
        <Panel title="Ontbrekende skills per afdeling" subtitle="Gemiddeld verschil tussen gesimuleerde vraag en interne dekking">
          <BarList ariaLabel="Ontbrekende skills per afdeling" items={skillGapsByDepartment(readiness.skillGaps)} />
        </Panel>
        <Panel title="Ontbrekende software" subtitle="Aandeel van de ontbrekende software per afdeling">
          <BarList ariaLabel="Ontbrekende software" items={softwareGapsByDepartment(readiness.softwareGaps)} />
        </Panel>
      </div>
    </div>
  )
}

export function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  return (
    <section className="mt-3 space-y-3">
      <h3 className="text-heading font-semibold">{dashboard.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dashboard.widgets.map((w, i) =>
          w.type === 'metric' ? (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-body-sm text-muted-foreground">{w.label}</p>
              <p className="text-metric font-semibold">{w.value}</p>
              {w.note && <p className="text-caption text-muted-foreground">{w.note}</p>}
            </div>
          ) : (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 sm:col-span-2 lg:col-span-3">
              <p className="mb-3 text-body font-medium">{w.title}</p>
              {w.items.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">Geen gegevens beschikbaar</p>
              ) : (
                <BarRows items={w.items} unit={w.unit} />
              )}
            </div>
          ),
        )}
      </div>
    </section>
  )
}

function BarRows({ items, unit }: { items: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0)
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3 text-body-sm sm:grid-cols-[11rem_1fr_4rem]">
          <span className="truncate">{item.label}</span>
          <span className="h-3 rounded-sm bg-muted">
            <span
              className="block h-full rounded-sm bg-accent"
              style={{ width: `${max > 0 ? Math.max(0, (item.value / max) * 100) : 0}%` }}
            />
          </span>
          <span className="text-right text-muted-foreground tabular-nums">
            {formatNumber(item.value)}
            {unit ? ` ${unit}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
