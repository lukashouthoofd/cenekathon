import { useState } from 'react'
import type { SkillGap } from '../types'

const pct = (v: number) => `${Math.round(v * 100)}%`

type Copy = 'idle' | 'ok' | 'failed'

function buildDraft(gap: SkillGap) {
  const title = `Vacature-concept: ${gap.name} (${gap.department})`
  const intro =
    gap.marketShare === null
      ? 'Het marktaandeel is onbekend'
      : `Deze functie helpt het team ${gap.name} toe te passen, omdat de markt ${pct(gap.marketShare)} van vergelijkbare vacatures hiervoor vraagt`
  const coverage =
    gap.internalCoverage === null
      ? 'Interne dekking is onbekend en moet eerst gemeten worden'
      : `Intern dekt ${pct(gap.internalCoverage)} van de benodigde skill`
  const bullets = [
    `Wat je doet: ${gap.name} toepassen binnen ${gap.department}`,
    `Wat we vragen: ervaring met ${gap.name}`,
    `Succescriterium: ${gap.name} is aantoonbaar toegepast in een pilot van 8 weken`,
  ]
  return { title, intro, coverage, bullets }
}

export function VacancyDraft({ gap }: { gap: SkillGap }) {
  const [copy, setCopy] = useState<Copy>('idle')
  const draft = buildDraft(gap)

  async function copyText() {
    const text = [draft.title, '', `${draft.intro}.`, draft.coverage + '.', '', ...draft.bullets.map((b) => `- ${b}`)].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopy('ok')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <h4 className="text-heading text-foreground">{draft.title}</h4>
      <p className="mt-2 text-body-sm text-foreground">{draft.intro}.</p>
      <p className="mt-1 text-body-sm text-foreground">{draft.coverage}.</p>
      <ul className="mt-2 list-disc pl-5 text-body-sm text-foreground">
        {draft.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={copyText}
          className="rounded-md bg-primary px-3 py-1 text-body-sm text-primary-foreground hover:opacity-90"
        >
          Kopieer tekst
        </button>
        <span role="status" className="text-body-sm text-muted-foreground">
          {copy === 'ok' ? 'Gekopieerd' : copy === 'failed' ? 'Kopiëren mislukt' : ''}
        </span>
      </div>
      <p className="mt-3 text-caption text-muted-foreground">
        Concept — HR controleert functie-eisen, salaris en wettelijke vereisten voordat er iets gepubliceerd wordt. Dit is
        geen gegenereerde vacature.
      </p>
    </div>
  )
}
