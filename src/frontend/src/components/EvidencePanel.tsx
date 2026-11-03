import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
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
    <aside aria-labelledby="evidence-h" className="lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Onderbouwing</p>
          <h2 id="evidence-h" className="mt-1 text-title font-semibold text-foreground">
            Bewijs
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-muted-foreground">
            {evidence.length} {evidence.length === 1 ? 'bron' : 'bronnen'}
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="evidence-list"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md px-2 py-1 text-body-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
          >
            {open ? 'Verbergen' : 'Tonen'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-body-sm text-muted-foreground">Bronnen die de analyse en aanbevelingen ondersteunen.</p>

      <div id="evidence-list" className={`mt-4 space-y-2 ${open ? '' : 'hidden lg:block'}`}>
        {missingIds.map((id) => (
          <p key={id} role="alert" className="rounded-md border border-caution p-2 text-body-sm text-caution">
            Bewijsfragment niet gevonden: {id}
          </p>
        ))}
        {evidence.length === 0 ? (
          <EmptyState title="Geen bewijsfragmenten beschikbaar" />
        ) : (
          evidence.map((e) => (
            <article
              key={e.id}
              className={`group relative overflow-hidden rounded-md border bg-surface px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                highlighted.has(e.id) ? 'border-accent ring-1 ring-accent' : 'border-border'
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[2px] bg-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              />
              <div className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                <span className="font-medium text-foreground">{SOURCE_LABELS[e.sourceType]}</span>
                {e.synthetic && <span className="text-caution">Gesimuleerd</span>}
              </div>
              <h3 className="mt-1 text-heading font-medium text-foreground">{e.title}</h3>
              <p className="mt-1 line-clamp-3 text-body-sm text-muted-foreground">{e.excerpt}</p>
              {e.url ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-body-sm text-accent no-underline hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Bekijk bron
                  <ExternalLink size={12} aria-hidden="true" />
                  <span className="sr-only">(opent in een nieuw tabblad)</span>
                </a>
              ) : (
                <p className="mt-2 text-body-sm text-muted-foreground">
                  <span aria-disabled="true" className="opacity-60">
                    Bekijk bron
                  </span>{' '}
                  <span className="text-caption">Geen link: deze bron heeft geen URL in de gegevens.</span>
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  )
}
