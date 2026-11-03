import { useEffect, useRef } from 'react'
import { FileText, X } from 'lucide-react'

type ActionPlanModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: () => void
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ActionPlanModal({ open, onClose, onGenerate }: ActionPlanModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [open])

  if (!open) return null

  function handleGenerate() {
    onGenerate()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-plan-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-lg focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-accent">
              <FileText size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-caption tracking-wider text-muted-foreground uppercase">Gepersonaliseerd</p>
              <h2 id="action-plan-title" className="mt-0.5 text-title font-semibold text-foreground">
                Maak je AI-actieplan
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-body text-muted-foreground">
          Het plan gebruikt de gesimuleerde gegevens van deze demo. De drie acties worden gerangschikt op impact,
          haalbaarheid en kwaliteit van het bewijs.
        </p>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            className="btn-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Genereer actieplan
          </button>
        </div>
      </div>
    </div>
  )
}
