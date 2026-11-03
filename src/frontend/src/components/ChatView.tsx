import { useEffect, useRef, useState } from 'react'
import { ApiError, DEMO_MODE, LIVE_CHAT, getOverview, sendChat } from '../api'
import type { ChatMessage, Overview } from '../types'
import { AdviceCard } from './AdviceCard'
import { DashboardView } from './DashboardView'
import { ChatSidebar } from './ChatSidebar'
import { Markdown } from './Markdown'
import { EXAMPLE_QUESTIONS } from './Onboarding'

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

  // Vervolgvragen are only offered under the last assistant reply.
  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant')

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
    <div className="flex min-w-0 flex-col gap-4">
      {DEMO_MODE && !LIVE_CHAT && (
        <p className="text-caption text-caution-text">Demo-modus: gesimuleerde gegevens</p>
      )}
      <div className="space-y-4">
        {messages.length === 0 && (
          <p className="text-body text-muted-foreground">
            {LIVE_CHAT
              ? 'Ik ben Json, de AI-readiness-assistent. Vraag bijvoorbeeld: geef een volledig rapport over welke opleidingen we nodig hebben en of we moeten aanwerven.'
              : 'Ik ben Json, de AI-readiness-assistent. Vraag bijvoorbeeld: maak een dashboard van Goldman Stanley.'}
          </p>
        )}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => send([{ role: 'user', content: question }])}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-body-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {question}
              </button>
            ))}
          </div>
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
                {i === lastAssistantIndex && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-caption text-muted-foreground">Vervolgvragen</span>
                    {m.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={pending}
                        onClick={() => send([...messages, { role: 'user', content: suggestion }])}
                        className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-body-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
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
    </div>
    <ChatSidebar messages={messages} overview={overview} error={overviewError} />
    </div>
  )
}
