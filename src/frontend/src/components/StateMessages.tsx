export function LoadingState() {
  return (
    <p role="status" aria-live="polite" className="text-body text-muted-foreground">
      Laden…
    </p>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-heading text-foreground">{title}</p>
      {body && <p className="mt-1 text-body text-muted-foreground">{body}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-[12px] border border-destructive bg-surface p-4">
      <p className="text-heading text-foreground">Er ging iets mis</p>
      <p className="mt-1 text-body text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-primary mt-3 min-h-10 px-4 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Opnieuw proberen
      </button>
    </div>
  )
}
