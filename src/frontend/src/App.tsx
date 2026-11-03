import { useEffect, useState } from 'react'
import { ActionCards } from './components/ActionCards'
import { EmptyState, ErrorState, LoadingState } from './components/StateMessages'
import { EvidencePanel, resolveEvidence } from './components/EvidencePanel'
import { ChatView } from './components/ChatView'
import { ScoreCards } from './components/ScoreCards'
import { SkillGaps } from './components/SkillGaps'
import { ApiError, DEMO_MODE, analyze, getCompanies, getReadiness } from './api'
import type { AnalyzeResponse, Company, Readiness } from './types'

export default function App() {
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState('')

  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  const [plan, setPlan] = useState<AnalyzeResponse | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(false)

  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState<'dashboard' | 'chat'>('dashboard')

  function loadCompanies() {
    setCompaniesError(null)
    getCompanies()
      .then((list) => {
        setCompanies(list)
        setCompanyId((current) => current || list[0]?.id || '')
      })
      .catch((e: unknown) => setCompaniesError(messageOf(e)))
  }

  useEffect(loadCompanies, [reloadKey])

  // Reset the plan and load readiness whenever the company changes.
  useEffect(() => {
    if (!companyId) return
    let stale = false
    setReadiness(null)
    setReadinessError(null)
    setReadinessLoading(true)
    setPlan(null)
    setPlanError(null)
    setSelectedEvidence([])
    getReadiness(companyId)
      .then((r) => !stale && setReadiness(r))
      .catch((e: unknown) => !stale && setReadinessError(messageOf(e)))
      .finally(() => !stale && setReadinessLoading(false))
    return () => {
      stale = true
    }
  }, [companyId, reloadKey])

  function makePlan() {
    if (!companyId) return
    setPlanLoading(true)
    setPlanError(null)
    setPlan(null)
    analyze(companyId)
      .then(setPlan)
      .catch((e: unknown) => setPlanError(messageOf(e)))
      .finally(() => setPlanLoading(false))
  }

  const resolved = readiness ? resolveEvidence(selectedEvidence, readiness.evidence) : null
  const company = companies?.find((c) => c.id === companyId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <h1 className="text-title font-semibold">AI-readiness</h1>
          {DEMO_MODE && (
            <span className="rounded-md border border-caution px-2 py-1 text-caption text-caution-text">
              Demomodus: gesimuleerde gegevens
            </span>
          )}
        </div>
      </header>

      <nav className="border-b border-border bg-surface px-6 py-2">
        <div className="mx-auto flex max-w-6xl gap-2">
          {(['dashboard', 'chat'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-body ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {t === 'dashboard' ? 'Dashboard' : 'Chat'}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'chat' ? (
        <div className="mx-auto max-w-6xl px-6 py-6">
          <ChatView />
        </div>
      ) : (
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-body-sm text-muted-foreground">
              Bedrijf
              {companiesError ? (
                <ErrorState message={companiesError} onRetry={loadCompanies} />
              ) : companies === null ? (
                <LoadingState />
              ) : companies.length === 0 ? (
                <EmptyState title="Geen bedrijven beschikbaar" />
              ) : (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.synthetic ? ' (gesimuleerd)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <button
              type="button"
              onClick={makePlan}
              disabled={!companyId || planLoading}
              className="rounded-md bg-primary px-4 py-2 text-body font-medium text-primary-foreground disabled:opacity-50"
            >
              {planLoading ? 'Actieplan wordt gemaakt…' : 'Maak actieplan'}
            </button>
          </section>

          {readinessLoading && <LoadingState />}
          {readinessError && (
            <ErrorState
              message={readinessError}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {readiness && (
            <>
              <section className="space-y-3">
                <div>
                  <h2 className="text-heading font-semibold">{readiness.companyName}</h2>
                  <p className="text-body-sm text-muted-foreground">
                    Periode {readiness.period.from} t/m {readiness.period.to} vergeleken met{' '}
                    {readiness.period.comparisonFrom} t/m {readiness.period.comparisonTo}
                    {(readiness.synthetic || company?.synthetic) && ' · gesimuleerde gegevens'}
                  </p>
                </div>
                <ScoreCards scores={readiness.scores} />
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <SkillGaps
                  gaps={readiness.skillGaps}
                  onSelectEvidence={setSelectedEvidence}
                />
              </div>
            </>
          )}

          {planError && (
            <ErrorState message={planError} onRetry={makePlan} />
          )}
          {planLoading && <LoadingState />}
          {plan && (
            <ActionCards
              actions={plan.actions}
              companyId={companyId}
              onShowEvidence={setSelectedEvidence}
              summary={plan.summary}
              limitations={plan.limitations}
              mode={plan.mode}
            />
          )}
        </div>

        {readiness && (
          <EvidencePanel
            evidence={resolved && selectedEvidence.length > 0 ? resolved.found : readiness.evidence}
            highlightIds={selectedEvidence}
            missingIds={resolved?.missing}
          />
        )}
      </main>
      )}
    </div>
  )
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return 'Er ging iets mis. Probeer het opnieuw.'
}
