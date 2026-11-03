export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="text-body text-muted-foreground">Laden…</p>
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
      <p className="text-heading text-foreground">{title}</p>
      {body && <p className="mt-1 text-body text-muted-foreground">{body}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive bg-surface p-4">
      <p className="text-heading text-destructive">Er ging iets mis</p>
      <p className="mt-1 text-body text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-primary px-3 py-1.5 text-body text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Opnieuw proberen
      </button>
    </div>
  )
}
