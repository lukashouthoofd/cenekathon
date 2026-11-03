export function AdviceCard({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-3">
      <p className="text-caption font-medium text-muted-foreground">Advies</p>
      <p className="mt-1 text-body">{text}</p>
    </div>
  )
}
