import { useEffect, useRef, useState } from 'react'
import { ApiError, DEMO_MODE, LIVE_CHAT, getOverview, sendChat } from '../api'
import type { ChatMessage, Overview } from '../types'
import { AdviceCard } from './AdviceCard'
import { DashboardView } from './DashboardView'
import { ChatSidebar } from './ChatSidebar'
import { Markdown } from './Markdown'

// A question picked outside the chat (for example from the onboarding panel) to send as a user message.
export type AskRequest = { text: string }

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

// Shown at the start, and whenever the last reply has no follow-up questions of its own.
const STARTERS = LIVE_CHAT
  ? [
      'Welke skills ontbreken het meest?',
      'Geef de drie belangrijkste acties',
      'Welke opleidingen hebben we nodig en moeten we aanwerven?',
    ]
  : ['Maak een dashboard van Goldman Stanley']

export function ChatView({ askRequest }: { askRequest?: AskRequest | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  useEffect(() => {
    getOverview()
      .then(setOverview)
      .catch((e: unknown) => setOverviewError(e instanceof ApiError ? e.message : 'Overzicht kon niet geladen worden.'))
  }, [])

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
        setError(e instanceof ApiError ? e.message : 'Dit lukte niet. Probeer het zo nog eens.'),
      )
      .finally(() => setPending(false))
  }

  // Sends a question picked outside the chat (onboarding) after the existing history.
  useEffect(() => {
    if (askRequest && !pending) send([...messages, { role: 'user', content: askRequest.text }])
  }, [askRequest])

  function submit() {
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    send([...messages, { role: 'user', content: text }])
  }

  function retry() {
    if (!pending) send(messages)
  }

  function ask(question: string) {
    if (!pending) send([...messages, { role: 'user', content: question }])
  }

  const last = messages[messages.length - 1]
  const followUp = last?.role === 'assistant' && !!last.suggestions?.length
  const suggestions = followUp ? last.suggestions! : STARTERS
  const label = followUp ? 'Goede vervolgvragen' : 'Ideeën om te vragen'

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
    <div className="flex min-w-0 flex-col gap-4">
      {DEMO_MODE && !LIVE_CHAT && (
        <p className="text-caption text-caution-text">Demo-modus: gesimuleerde gegevens</p>
      )}
      <div className="space-y-4">
        {messages.length === 0 && (
          <p className="text-body text-muted-foreground">
            Ik ben Json, de AI-readiness-assistent. Stel een vraag of kies een idee onder het invoerveld.
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
                {m.role === 'assistant' && <p className="text-caption text-muted-foreground">Json</p>}
                {body &&
                  (m.role === 'assistant' ? (
                    <Markdown text={body} refs={overview?.refs} />
                  ) : (
                    <p className="whitespace-pre-wrap">{body}</p>
                  ))}
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
          placeholder={messages.length === 0 ? 'Stel Json een vraag…' : 'Typ je bericht…'}
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
      <section aria-label={label} className="-mt-1">
        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={pending}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-left text-body-sm text-foreground shadow-sm transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{q}</span>
              <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text">
                →
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
    <ChatSidebar messages={messages} overview={overview} error={overviewError} />
    </div>
  )
}
