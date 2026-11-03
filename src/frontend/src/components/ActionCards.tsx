import { useState } from 'react'
import type { Action, ActionType } from '../types'
import { EmptyState } from './StateMessages'
import { SlackPreviewDialog } from './SlackPreviewDialog'
import { formatNumber } from '../format'

interface Props {
  actions: Action[]
  companyId: string
  summary?: string
  limitations?: string[]
  mode: 'live' | 'demo'
}

const TYPE_LABEL: Record<ActionType, string> = {
  training: 'Intern opleiden',
  software: 'Bestaande software inzetten',
  internal_tool: 'Interne tool bouwen',
}

const btn = 'rounded-md border border-border px-3 py-1 text-body-sm hover:bg-muted'

export function ActionCards({ actions, companyId, summary, limitations, mode }: Props) {
  const [slackAction, setSlackAction] = useState<Action | null>(null)
  const sorted = [...actions].sort((a, b) => a.rank - b.rank)

  return (
    <section aria-labelledby="actieplan-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="actieplan-title" className="text-title font-semibold">
          Actieplan
        </h2>
        {mode === 'demo' && (
          <span className="rounded-md border border-caution px-2 py-0.5 text-caption text-caution-text">
            Voorbeeldvoorstel van Json, niet gecontroleerd
          </span>
        )}
      </div>
      {summary && <p className="text-body">{summary}</p>}
      {limitations && limitations.length > 0 && (
        <div>
          <h3 className="text-body-sm font-semibold">Let op: wat deze cijfers niet zeggen</h3>
          <ul className="list-disc pl-5 text-body-sm text-muted-foreground">
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="Geen acties gevonden"
          body="Er is te weinig data om betrouwbare acties voor dit bedrijf af te leiden."
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {sorted.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-caption">
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-accent-text tabular-nums">Volgorde {formatNumber(a.rank)}</span>
                <span className="text-muted-foreground">{TYPE_LABEL[a.type]}</span>
              </div>
              <h3 className="text-heading font-semibold">{a.title}</h3>
              <dl className="flex flex-col gap-2 text-body">
                {a.bullets.length > 0 && (
                  <div>
                    <dt className="text-body-sm font-semibold">Waarom relevant</dt>
                    <dd>{a.bullets[0]}</dd>
                  </div>
                )}
                {a.bullets.length > 1 && (
                  <div>
                    <dt className="text-body-sm font-semibold">Wat het bedrijf moet doen</dt>
                    <dd>
                      <ul className="list-disc pl-5">
                        {a.bullets.slice(1).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-body-sm font-semibold">Afdeling</dt>
                  <dd>{a.department}</dd>
                </div>
                <div>
                  <dt className="text-body-sm font-semibold">Proefperiode</dt>
                  <dd className="line-clamp-4">{a.pilot}</dd>
                </div>
                <div>
                  <dt className="text-body-sm font-semibold">Wanneer is het gelukt?</dt>
                  <dd>{a.successMetric}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btn} onClick={() => setSlackAction(a)}>
                  Bekijk bericht voor Slack (nog niet verstuurd)
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {slackAction && (
        <SlackPreviewDialog
          companyId={companyId}
          actionId={slackAction.id}
          actionTitle={slackAction.title}
          onClose={() => setSlackAction(null)}
        />
      )}
    </section>
  )
}
