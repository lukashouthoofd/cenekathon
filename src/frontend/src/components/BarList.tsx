import { formatPercent } from '../format'

export type BarColour = 'accent' | 'data-2' | 'data-3' | 'tertiary'

export type BarItem = { label: string; value: number; colour: BarColour }

const FILL: Record<BarColour, string> = {
  accent: 'bg-accent',
  'data-2': 'bg-data-2',
  'data-3': 'bg-data-3',
  tertiary: 'bg-tertiary-foreground',
}

/** Flat horizontal bars: label and percentage on one row, a thin bar underneath. No axes, legend or gridlines. */
export function BarList({
  items,
  scale = 'fraction',
  ariaLabel,
}: {
  items: BarItem[]
  /** 'fraction' means value is 0-1, 'percent' means value is 0-100. */
  scale?: 'fraction' | 'percent'
  ariaLabel: string
}) {
  if (items.length === 0) return <p className="text-body-sm text-muted-foreground">Geen gegevens beschikbaar</p>

  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((item) => {
        const fraction = Math.min(1, Math.max(0, scale === 'percent' ? item.value / 100 : item.value))
        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-body-sm">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatPercent(fraction)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-muted">
              <div className={`h-full ${FILL[item.colour]}`} style={{ width: `${fraction * 100}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
