import { useState } from 'react'
import type { SkillGap } from '../types'
import { formatPercent } from '../format'

type Copy = 'idle' | 'ok' | 'failed'

function buildDraft(gap: SkillGap) {
  const title = `Vacature-concept: ${gap.name} (${gap.department})`
  const intro =
    gap.marketShare === null
      ? 'Het aandeel in de vacatures is onbekend'
      : `Deze functie helpt het team ${gap.name} toe te passen, omdat de semantische match in vacatures 2025 ${formatPercent(gap.marketShare, 2)} is`
  const coverage =
    gap.internalCoverage === null
      ? 'Intern is nog niet gemeten wie dit kan'
      : `Intern kan ${formatPercent(gap.internalCoverage)} van de mensen dit al`
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
    <div className="rounded-[12px] border border-border bg-surface p-4">
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
          className="btn-primary min-h-10 px-4 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Kopieer tekst
        </button>
        <span role="status" className="text-body-sm text-muted-foreground">
          {copy === 'ok' ? 'Gekopieerd' : copy === 'failed' ? 'Kopiëren mislukt' : ''}
        </span>
      </div>
      <p className="mt-3 text-caption text-muted-foreground">
        Dit is een eerste opzet. HR controleert eisen, salaris en wetgeving voor publicatie.
      </p>
    </div>
  )
}
