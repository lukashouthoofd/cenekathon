import type { Score, ScoreDimension } from '../types'
import { KpiCard, type KpiColour } from './KpiCard'

const LABELS: Record<ScoreDimension, string> = {
  skills: 'Vaardigheden',
  ai_usage: 'AI-gebruik',
  training: 'Opleiding',
}

const COLOURS: Record<ScoreDimension, KpiColour> = {
  skills: 'accent',
  ai_usage: 'data-2',
  training: 'data-3',
}

export function ScoreCards({ scores }: { scores: Score[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {scores.map((s) => (
        <KpiCard
          key={s.dimension}
          title={LABELS[s.dimension]}
          value={s.value}
          coverage={s.coverage}
          trend={s.trend}
          explanation={s.explanation}
          colour={COLOURS[s.dimension]}
        />
      ))}
    </div>
  )
}
