import { useState } from 'react'
import type { Evidence, EvidenceSourceType } from '../types'
import { EmptyState } from './StateMessages'

const SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  vacancy: 'Vacature',
  internal: 'Intern (gesimuleerd)',
  derived: 'Afgeleid',
}

export function resolveEvidence(ids: string[], evidence: Evidence[]): { found: Evidence[]; missing: string[] } {
  const byId = new Map(evidence.map((e) => [e.id, e]))
  const found: Evidence[] = []
  const missing: string[] = []
  for (const id of ids) {
    const e = byId.get(id)
    if (e) found.push(e)
    else missing.push(id)
  }
  return { found, missing }
}

export function EvidencePanel({
  evidence,
  highlightIds,
  missingIds = [],
}: {
  evidence: Evidence[]
  highlightIds: string[]
  missingIds?: string[]
}) {
  const [open, setOpen] = useState(true)
  const highlighted = new Set(highlightIds)

  return (
    <aside aria-labelledby="evidence-h" className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 id="evidence-h" className="text-title text-foreground">Bewijs</h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="evidence-list"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md px-2 py-1 text-body-sm text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
        >
          {open ? 'Verbergen' : 'Tonen'}
        </button>
      </div>
      <div id="evidence-list" className={`mt-3 space-y-3 ${open ? '' : 'hidden lg:block'}`}>
        {missingIds.map((id) => (
          <p key={id} role="alert" className="rounded-md border border-caution p-2 text-body-sm text-caution-text">
            Bewijsfragment niet gevonden: {id}
          </p>
        ))}
        {evidence.length === 0 ? (
          <EmptyState title="Geen bewijsfragmenten beschikbaar" />
        ) : (
          evidence.map((e) => (
            <article
              key={e.id}
              className={`rounded-lg border bg-surface p-3 ${
                highlighted.has(e.id) ? 'border-accent ring-2 ring-accent' : 'border-border'
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-caption text-foreground">
                  {SOURCE_LABELS[e.sourceType]}
                </span>
                {e.synthetic && (
                  <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-caption text-accent-text">Gesimuleerd</span>
                )}
              </div>
              <h3 className="mt-2 text-heading text-foreground">{e.title}</h3>
              <p className="mt-1 text-body-sm text-muted-foreground">{e.excerpt}</p>
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-body-sm text-accent-text underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Bron openen
                </a>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  )
}
