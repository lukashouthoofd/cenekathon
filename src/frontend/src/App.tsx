import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Download, Info } from 'lucide-react'
import { ActionCards } from './components/ActionCards'
import { ActionPlanModal } from './components/ActionPlanModal'
import { EmptyState, ErrorState, LoadingState } from './components/StateMessages'
import { ChatView } from './components/ChatView'
import type { AskRequest } from './components/ChatView'
import { Onboarding } from './components/Onboarding'
import { ReadinessDashboard } from './components/DashboardView'
import { exportReport, toReportData } from './export'
import { ApiError, DEMO_MODE, analyze, getCompanies, getReadiness } from './api'
import type { AnalyzeResponse, Company, Readiness } from './types'

const ONBOARDING_KEY = 'json-onboarding-gezien'

// Shown above the dashboard. The data period is fixed in the demo fixture.
const REPORT_PERIOD = '1 jan – 30 jun 2026 · vergeleken met dezelfde periode in 2025'

// localStorage can throw (for example when storage is disabled), so reads and writes are guarded.
function onboardingSeen(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) !== null
  } catch {
    return false
  }
}

function markOnboardingSeen() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // Without storage the panel simply shows again on the next visit.
  }
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => !onboardingSeen())
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null)

  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState('')

  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  const [plan, setPlan] = useState<AnalyzeResponse | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [actionPlanOpen, setActionPlanOpen] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const planRequest = useRef(0)
  const planSection = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'dashboard' | 'chat'>('dashboard')

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false)
    markOnboardingSeen()
  }, [])

  function pickQuestion(text: string) {
    closeOnboarding()
    setTab('chat')
    setAskRequest({ text })
  }

  function loadCompanies() {
    setCompaniesError(null)
    getCompanies()
      .then((list) => {
        setCompanies(list)
        setCompanyId((current) => current || list[0]?.id || '')
      })
      .catch((e: unknown) => setCompaniesError(messageOf(e)))
  }

  // The company/readiness/analyze endpoints are only served in demo mode.
  useEffect(() => {
    if (DEMO_MODE) loadCompanies()
  }, [reloadKey])

  // Reset the plan and load readiness whenever the company changes.
  useEffect(() => {
    if (!DEMO_MODE || !companyId) return
    let stale = false
    setReadiness(null)
    setReadinessError(null)
    setReadinessLoading(true)
    planRequest.current++
    setPlan(null)
    setPlanError(null)
    setPlanLoading(false)
    getReadiness(companyId)
      .then((r) => !stale && setReadiness(r))
      .catch((e: unknown) => !stale && setReadinessError(messageOf(e)))
      .finally(() => !stale && setReadinessLoading(false))
    return () => {
      stale = true
    }
  }, [companyId, reloadKey])

  // The plan renders below the score cards; bring it into view when it is requested or arrives.
  useEffect(() => {
    if (planLoading || plan) planSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [planLoading, plan])

  function makePlan() {
    if (!companyId) return
    setPlanLoading(true)
    setPlanError(null)
    setPlan(null)
    const id = ++planRequest.current
    analyze(companyId)
      .then((p) => id === planRequest.current && setPlan(p))
      .catch((e: unknown) => id === planRequest.current && setPlanError(messageOf(e)))
      .finally(() => id === planRequest.current && setPlanLoading(false))
  }

  function handleExport() {
    if (readiness) exportReport(toReportData(readiness))
  }

  const company = companies?.find((c) => c.id === companyId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-dark-section">
        <div className="mx-auto flex min-h-[72px] max-w-[1360px] flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-10">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-md bg-accent text-heading font-bold text-accent-foreground"
            >
              J
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-section font-semibold">Json</span>
              <span className="label-caps">AI-readiness</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {DEMO_MODE && (
              <span className="rounded-md border border-caution px-2 py-1 text-caption text-caution-text">
                Demomodus: gesimuleerd
              </span>
            )}
            <button
              type="button"
              aria-label="Rondleiding openen"
              onClick={() => setShowOnboarding(true)}
              className="btn-secondary"
            >
              <Info aria-hidden="true" size={16} />
              Rondleiding
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Weergave" className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1360px] gap-6 px-6 md:px-10">
          {(['dashboard', 'chat'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 py-3 text-body font-medium transition-colors ${
                tab === t
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'dashboard' ? 'Dashboard' : 'Json'}
            </button>
          ))}
        </div>
      </nav>

      <main>
        {/* Kept mounted so chat history and any pending request survive tab switches. */}
        <div className={tab === 'chat' ? 'mx-auto max-w-[1360px] px-6 py-7 md:px-10' : 'hidden'}>
          <ChatView askRequest={askRequest} />
        </div>

        {tab === 'dashboard' && !DEMO_MODE && (
          <div className="mx-auto max-w-[1360px] px-6 py-7 md:px-10">
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-section font-semibold">Dashboard alleen beschikbaar in demomodus</h2>
              <p className="mt-1 text-body text-muted-foreground">
                Dit dashboard toont gesimuleerde gegevens. Zet VITE_DEMO_MODE=true om het te gebruiken. De chat werkt op echte gegevens.
              </p>
            </section>
          </div>
        )}

        {tab === 'dashboard' && DEMO_MODE && (
          <div className="mx-auto max-w-[1360px] space-y-7 px-6 py-7 md:px-10">
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="label-caps flex items-center gap-2">
                  <Building2 aria-hidden="true" size={14} />
                  Organisatie
                </span>
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
                    className="min-h-10 w-full rounded-md border border-border-strong bg-background px-3 py-2 text-body text-foreground"
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
                onClick={() => setActionPlanOpen(true)}
                disabled={!companyId || planLoading}
                className="btn-primary w-full sm:w-auto"
              >
                {planLoading ? 'Actieplan wordt gemaakt…' : 'Maak actieplan'}
              </button>
            </section>

            <div className="min-w-0 space-y-7">
              <div className="min-w-0 space-y-7">
                {readinessLoading && <LoadingState />}
                {readinessError && (
                  <ErrorState message={readinessError} onRetry={() => setReloadKey((k) => k + 1)} />
                )}

                {readiness && (
                  <>
                    <section className="space-y-5">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                          <p className="label-caps text-positive-text">Rapport beschikbaar</p>
                          <h1 className="text-title font-bold break-words">{readiness.companyName}</h1>
                          <p className="text-caption text-muted-foreground">
                            {REPORT_PERIOD}
                            {(readiness.synthetic || company?.synthetic) && ' · gesimuleerde gegevens'}
                          </p>
                        </div>
                        <button type="button" onClick={handleExport} className="btn-secondary">
                          <Download aria-hidden="true" size={16} />
                          Exporteer rapport
                        </button>
                      </div>
                      <ReadinessDashboard readiness={readiness} />
                    </section>
                  </>
                )}

                {planError && <ErrorState message={planError} onRetry={makePlan} />}
                <div ref={planSection} className="scroll-mt-6 space-y-7">
                  {planLoading && <LoadingState />}
                  {plan && (
                    <ActionCards
                      actions={plan.actions}
                      companyId={companyId}
                      summary={plan.summary}
                      limitations={plan.limitations}
                      mode={plan.mode}
                    />
                  )}
                </div>
              </div>

            </div>

            <ActionPlanModal
              open={actionPlanOpen}
              onClose={() => setActionPlanOpen(false)}
              onGenerate={makePlan}
            />
          </div>
        )}
      </main>

      {showOnboarding && <Onboarding onClose={closeOnboarding} onPickQuestion={pickQuestion} />}
    </div>
  )
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return 'Er ging iets mis. Probeer het opnieuw.'
}
