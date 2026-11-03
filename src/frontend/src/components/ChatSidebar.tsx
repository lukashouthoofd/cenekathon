import type { ChatMessage, Overview, ProposedVacancy } from '../types'
import { formatNumber } from '../format'

const LABELS: Record<string, string> = { skills: 'Vaardigheden', ai_usage: 'AI-gebruik', training: 'Opleiding' }

/** Vacancies the agent proposed, newest reply first. */
function proposedIn(messages: ChatMessage[]): { documentId: string; vacancies: ProposedVacancy[] }[] {
  return messages.flatMap((m) => (m.role === 'assistant' ? (m.proposed ?? []) : [])).reverse()
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
  const proposed = proposedIn(messages)

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
                    {g.growthPct === null ? 'Groei onbekend' : `Markt +${formatNumber(g.growthPct)}% per jaar`} ·{' '}
                    <span className={g.internalPeople === 0 ? 'text-caution-text' : undefined}>
                      {g.internalPeople === null
                        ? 'intern onbekend'
                        : `intern ${g.internalPeople} ${g.internalPeople === 1 ? 'persoon' : 'mensen'}`}
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
                  {s.repetitiveHoursPerWeek !== null && s.repetitiveHoursPerWeek > 0 && (
                    <p className="text-caption text-caution-text">
                      {formatNumber(s.repetitiveHoursPerWeek)} u/week repetitief werk bij deze gebruikers
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-muted-foreground">Vraag in de chat welke software ontbreekt.</p>
          </Card>
        </>
      )}

      <Card title="Voorgestelde vacatures">
        {proposed.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            Nog geen voorstellen. Vraag Json bijvoorbeeld welke rollen het bedrijf moet aanwerven.
          </p>
        ) : (
          <ul className="space-y-4">
            {proposed.map((doc, i) => (
              <li key={doc.documentId} className={i > 0 ? 'opacity-60' : undefined}>
                {i === 1 && <p className="mb-2 text-caption text-muted-foreground">Eerdere voorstellen</p>}
                <ul className="divide-y divide-border">
                  {doc.vacancies.map((v) => (
                    <li key={v.title} className="py-2 first:pt-0">
                      <p className="text-body-sm font-medium">{v.title}</p>
                      <p className="text-caption text-muted-foreground">{v.department}</p>
                      {i === 0 && <p className="mt-1 text-caption">{v.intro}</p>}
                      {i === 0 && v.linkedinSearch && (
                        <details className="mt-1 text-caption">
                          <summary className="cursor-pointer text-accent-text">LinkedIn-zoekstring</summary>
                          <code className="mt-1 block break-words rounded-sm bg-muted p-2">{v.linkedinSearch}</code>
                        </details>
                      )}
                      {i === 0 && v.basedOn && v.basedOn.length > 0 && (
                        <p className="mt-1 text-caption text-muted-foreground">
                          Gebaseerd op {v.basedOn.length} echte {v.basedOn.length === 1 ? 'vacature' : 'vacatures'}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <a href={`/api/documents/${doc.documentId}`} download className="text-body-sm text-accent-text underline">
                  Download vacatureteksten (Word)
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  )
}
