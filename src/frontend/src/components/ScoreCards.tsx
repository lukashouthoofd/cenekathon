import type { Score, ScoreDimension } from '../types'
import { formatPercent, formatScore } from '../format'

const LABELS: Record<ScoreDimension, string> = {
  skills: 'Vaardigheden',
  ai_usage: 'AI-gebruik',
  training: 'Opleiding',
}

function Bar({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      className="h-1.5 w-full overflow-hidden rounded-sm bg-muted-strong"
    >
      <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }} />
    </div>
  )
}

export function ScoreCards({ scores }: { scores: Score[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {scores.map((s) => {
        const label = LABELS[s.dimension]
        return (
          <section key={s.dimension} aria-label={label} className="rounded-md border border-border bg-surface p-4">
            <h3 className="text-heading text-foreground">{label}</h3>
            <p
              className={`mt-2 text-metric ${s.value === null ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {formatScore(s.value)}
              {s.value !== null && ' / 100'}
            </p>
            {s.value !== null && (
              <div className="mt-2">
                <Bar fraction={s.value / 100} label={`${label} score`} />
              </div>
            )}
            <p className="mt-3 text-body-sm text-muted-foreground">Datadekking {formatPercent(s.coverage)}</p>
            <div className="mt-1">
              <Bar fraction={s.coverage} label={`${label} datadekking`} />
            </div>
            {s.coverage < 0.3 && (
              <p className="mt-2 text-body-sm text-caution-text">Beperkte data: interpreteer met voorzichtigheid.</p>
            )}
            <p className="mt-3 text-body text-foreground">{s.explanation}</p>
          </section>
        )
      })}
    </div>
  )
}
