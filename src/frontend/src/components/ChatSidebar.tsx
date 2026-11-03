import type { ChatMessage, Overview } from '../types'

const LABELS: Record<string, string> = { skills: 'Vaardigheden', ai_usage: 'AI-gebruik', training: 'Opleiding' }

/** Download links the backend appended to assistant replies, newest first. */
function documentsIn(messages: ChatMessage[]): string[] {
  const urls = messages.flatMap((m) =>
    m.role === 'assistant' ? [...m.content.matchAll(/\/api\/documents\/[0-9a-f-]{36}/g)].map((x) => x[0]) : [],
  )
  return [...new Set(urls)].reverse()
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-heading font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function ChatSidebar({
  messages,
  overview,
  error,
}: {
  messages: ChatMessage[]
  overview: Overview | null
  error: string | null
}) {
  const documents = documentsIn(messages)

  return (
    <aside className="space-y-4" aria-label="Overzicht">
      {error && <p className="text-body-sm text-muted-foreground">{error}</p>}

      {overview && (
        <>
          <Card title={overview.company.name}>
            <p className="text-body-sm text-muted-foreground">
              {overview.company.sector} · {overview.company.employees} medewerkers
              {overview.synthetic && ' · fictieve bedrijfsdata'}
            </p>
          </Card>

          <Card title="AI-readiness">
            <ul className="space-y-3">
              {overview.scores.map((s) => (
                <li key={s.dimension} title={s.explanation}>
                  <div className="flex items-baseline justify-between text-body-sm">
                    <span>{LABELS[s.dimension] ?? s.dimension}</span>
                    <span className="font-medium">{s.value === null ? 'Onbekend' : `${s.value} / 100`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-muted-strong">
                    <div className="h-full bg-accent" style={{ width: `${s.value ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-caption text-muted-foreground">Datadekking: {s.coverage}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Grootste kloven">
            <ul className="divide-y divide-border">
              {overview.gaps.map((g) => (
                <li key={g.ref} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-body-sm font-medium">{g.skill}</p>
                  <p className="text-caption text-muted-foreground">
                    Markt +{g.growthPct}% per jaar ·{' '}
                    <span className={g.internalPeople === 0 ? 'text-caution-text' : undefined}>
                      intern {g.internalPeople} {g.internalPeople === 1 ? 'persoon' : 'mensen'}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Software en AI">
            <ul className="divide-y divide-border">
              {overview.software.map((s) => (
                <li key={s.ref} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-body-sm font-medium">{s.name}</p>
                  <p className="text-caption text-muted-foreground">
                    AI: {s.aiFeatures} · {s.usedBy}
                  </p>
                  {s.repetitiveHoursPerWeek > 0 && (
                    <p className="text-caption text-caution-text">
                      {s.repetitiveHoursPerWeek} u/week repetitief werk bij deze gebruikers
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-muted-foreground">Vraag in de chat welke software ontbreekt.</p>
          </Card>
        </>
      )}

      <Card title="Vacaturedocumenten">
        {documents.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">Nog geen documenten. Stel een vraag in de chat.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((url, i) => (
              <li key={url}>
                <a href={url} download className="text-body-sm text-accent-text underline">
                  Vacatures (Word) #{documents.length - i}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  )
}
