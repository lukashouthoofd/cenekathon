import { useEffect, useRef, useState } from 'react'
import { ApiError, DEMO_MODE, sendChat } from '../api'
import type { ChatMessage } from '../types'
import { AdviceCard } from './AdviceCard'
import { DashboardView } from './DashboardView'

// Splits off the last line starting with "Advies:" (after trimming) from an assistant reply.
function splitAdvice(content: string): { body: string; advice: string | null } {
  const lines = content.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = /^Advies:\s*(\S.*)$/.exec(lines[i].trim())
    if (match) {
      return { body: lines.filter((_, j) => j !== i).join('\n').trim(), advice: match[1].trim() }
    }
  }
  return { body: content, advice: null }
}

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, pending, error])

  function send(history: ChatMessage[]) {
    setMessages(history)
    setPending(true)
    setError(null)
    sendChat(history)
      .then((r) => setMessages([...history, r.message]))
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : 'Er ging iets mis. Probeer het opnieuw.'),
      )
      .finally(() => setPending(false))
  }

  function submit() {
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    send([...messages, { role: 'user', content: text }])
  }

  function retry() {
    if (!pending) send(messages)
  }

  return (
    <div className="flex flex-col gap-4">
      {DEMO_MODE && (
        <p className="text-caption text-caution-text">Demo-modus: gesimuleerde gegevens</p>
      )}
      <div className="space-y-4">
        {messages.length === 0 && (
          <p className="text-body text-muted-foreground">
            Welkom! Stel een vraag of vraag om een dashboard, bijvoorbeeld: maak een dashboard van Bank Vandermeulen.
          </p>
        )}
        {messages.map((m, i) => {
          const { body, advice } =
            m.role === 'assistant' ? splitAdvice(m.content) : { body: m.content, advice: null }
          return (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-lg bg-primary px-4 py-2 text-body text-primary-foreground'
                    : 'w-full rounded-lg border border-border bg-surface px-4 py-3 text-body'
                }
              >
                {body && <p className="whitespace-pre-wrap">{body}</p>}
                {advice && <AdviceCard text={advice} />}
                {m.dashboard && <DashboardView dashboard={m.dashboard} />}
              </div>
            </div>
          )
        })}
        {pending && (
          <p role="status" aria-live="polite" className="text-body text-muted-foreground">
            Aan het nadenken…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive bg-surface p-4">
            <p className="text-body text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={retry}
              disabled={pending}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-body text-primary-foreground disabled:opacity-50"
            >
              Opnieuw proberen
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          aria-label="Bericht"
          placeholder="Typ je bericht…"
          className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-body text-foreground"
        />
        <button
          type="submit"
          disabled={pending || input.trim() === ''}
          className="rounded-md bg-primary px-4 py-2 text-body font-medium text-primary-foreground disabled:opacity-50"
        >
          Verstuur
        </button>
      </form>
    </div>
  )
}
