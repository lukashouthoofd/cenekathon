import { formatPercent, formatScore } from '../format'

export type KpiColour = 'accent' | 'data-2' | 'data-3'

const FILL: Record<KpiColour, string> = {
  accent: 'bg-accent',
  'data-2': 'bg-data-2',
  'data-3': 'bg-data-3',
}

export function KpiCard({
  title,
  value,
  coverage,
  trend,
  explanation,
  colour,
}: {
  title: string
  /** 0-100; null means unknown and is never shown as 0. */
  value: number | null
  /** 0-1 share of the data that was measured. */
  coverage: number
  /** Simulated change in the demo; the badge is hidden when absent. */
  trend?: number
  explanation: string
  colour: KpiColour
}) {
  const known = value !== null
  const fraction = known ? Math.min(1, Math.max(0, value / 100)) : 0

  return (
    <section aria-label={title} className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-heading text-foreground">{title}</h3>
        {known && trend !== undefined && (
          <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-caption tabular-nums text-muted-foreground">
            Trend: {trend > 0 ? '+' : ''}
            {trend} <span className="text-tertiary-foreground">gesimuleerd</span>
          </span>
        )}
      </div>

      <p className={`mt-3 text-[34px] leading-none font-semibold tabular-nums ${known ? 'text-foreground' : 'text-muted-foreground'}`}>
        {formatScore(value)}
        {known && ' / 100'}
      </p>

      {known && (
        <div
          role="meter"
          aria-label={`${title} score`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-muted"
        >
          <div className={`h-full ${FILL[colour]}`} style={{ width: `${fraction * 100}%` }} />
        </div>
      )}

      <div className="mt-4">
        <p className="text-body-sm text-muted-foreground tabular-nums">Datadekking: {formatPercent(coverage)}</p>
        <div
          role="meter"
          aria-label={`${title} datadekking`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(coverage * 100)}
          className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-muted"
        >
          <div className="h-full bg-tertiary-foreground" style={{ width: `${Math.min(100, Math.max(0, coverage * 100))}%` }} />
        </div>
      </div>

      {coverage < 0.3 && (
        <p className="mt-3 text-body-sm text-caution-text">Er is weinig gemeten. Lees deze score als een grove schatting.</p>
      )}

      <p className="mt-4 border-t border-border pt-3 text-body-sm text-muted-foreground">{explanation}</p>
    </section>
  )
}
