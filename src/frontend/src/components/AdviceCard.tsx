export function AdviceCard({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-[10px] border border-border bg-background p-3">
      <p className="text-caption font-medium text-muted-foreground">Advies</p>
      <p className="mt-1 text-body text-foreground">{text}</p>
    </div>
  )
}
