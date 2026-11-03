import { useEffect, useRef } from 'react'

export const EXAMPLE_QUESTIONS = [
  'Welke skills missen we het meest bij Bank Vandermeulen?',
  'Hoe staat Bank Vandermeulen er voor op AI-gebruik?',
  'Welke vacatures vragen om AI-skills in 2025?',
  'Maak een dashboard van Bank Vandermeulen',
  'Hoeveel vacatures noemen Python in 2025?',
  'Wat moet HR als eerste doen?',
]

const STEPS = [
  'Json beantwoordt vragen over AI-readiness en vacatures bij financiële bedrijven.',
  'De bedrijfscijfers zijn gesimuleerd (Bank Vandermeulen). Marktcijfers zijn trefwoordtellingen, geen bewezen skills.',
  'Kies een voorbeeldvraag hieronder of typ je eigen vraag.',
]

type OnboardingProps = {
  onClose: () => void
  onPickQuestion: (question: string) => void
}

export function Onboarding({ onClose, onPickQuestion }: OnboardingProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="onboarding-title" className="text-heading font-semibold">
            Welkom bij Json
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sluiten
          </button>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-body">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="space-y-2">
          <p className="text-body-sm text-muted-foreground">Voorbeeldvragen</p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onPickQuestion(question)}
                className="rounded-md border border-border bg-background px-3 py-2 text-left text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
