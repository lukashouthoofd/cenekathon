import type { Dashboard } from '../types'

export function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  return (
    <section className="mt-3 space-y-3">
      <h3 className="text-heading font-semibold">{dashboard.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dashboard.widgets.map((w, i) =>
          w.type === 'metric' ? (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-body-sm text-muted-foreground">{w.label}</p>
              <p className="text-metric font-semibold">{w.value}</p>
              {w.note && <p className="text-caption text-muted-foreground">{w.note}</p>}
            </div>
          ) : (
            <div key={i} className="rounded-lg border border-border bg-surface p-4 sm:col-span-2 lg:col-span-3">
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
          <span className="text-right text-muted-foreground">
            {item.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
