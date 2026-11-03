import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_MODE, getSlackPreview } from '../api'
import { LoadingState } from './StateMessages'

interface Props {
  companyId: string
  actionId: string
  actionTitle: string
  onClose: () => void
}

type Copy = 'idle' | 'ok' | 'failed'

export function SlackPreviewDialog({ companyId, actionId, actionTitle, onClose }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [copy, setCopy] = useState<Copy>('idle')
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let stale = false
    setText(null)
    setError(null)
    getSlackPreview(companyId, actionId).then(
      (t) => {
        if (!stale) setText(t)
      },
      (e: unknown) => {
        if (!stale) setError(e instanceof Error ? e.message : 'Het Slack-bericht kon niet worden geladen.')
      },
    )
    return () => {
      stale = true
    }
  }, [companyId, actionId, attempt])

  // Focus into the dialog on open, back to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => trigger?.focus()
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCloseRef.current()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const items = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  async function copyText() {
    if (text === null) return
    try {
      await navigator.clipboard.writeText(text)
      setCopy('ok')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slack-dialog-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[12px] border border-border bg-surface p-5 outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="slack-dialog-title" className="text-heading font-semibold">
              Slack-bericht
            </h2>
            <p className="text-body-sm text-muted-foreground">{actionTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary min-h-10 px-3 text-body-sm hover:bg-muted active:bg-muted-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sluiten
          </button>
        </div>

        {error !== null ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-body text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="btn-primary min-h-10 px-4 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : text === null ? (
          <LoadingState />
        ) : (
          <>
            <pre className="whitespace-pre-wrap break-words rounded-[8px] border border-border bg-muted p-3 font-mono text-body-sm text-foreground">
              {text}
            </pre>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copyText}
                className="btn-primary min-h-10 px-4 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Kopieer
              </button>
              <span role="status" className="text-body-sm text-muted-foreground">
                {copy === 'ok' ? 'Gekopieerd' : copy === 'failed' ? 'Kopiëren mislukt' : ''}
              </span>
            </div>
            {DEMO_MODE && (
              <p className="text-caption text-muted-foreground">Demo-voorbeeld — dit bericht is niet verzonden</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
