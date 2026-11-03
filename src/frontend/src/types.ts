// Contract with the backend. Scores 0-100; coverage, marketShare, internalCoverage 0-1.
// A null score means "unknown" and must never be shown as 0.

export interface Company {
  id: string
  name: string
  industry: string
  country: string
  synthetic: boolean
}

export interface CompaniesResponse {
  companies: Company[]
}

export type ScoreDimension = 'skills' | 'ai_usage' | 'training'

export interface Score {
  dimension: ScoreDimension
  value: number | null
  coverage: number
  explanation: string
  evidenceIds: string[]
}

export interface SkillGap {
  skillId: string
  name: string
  department: string
  /** Share of comparable vacancies asking for the skill. */
  marketShare: number | null
  internalCoverage: number | null
  explanation: string
  evidenceIds: string[]
}

export type EvidenceSourceType = 'vacancy' | 'internal' | 'derived'

export interface Evidence {
  id: string
  sourceType: EvidenceSourceType
  title: string
  excerpt: string
  synthetic: boolean
  url?: string
}

export interface Readiness {
  companyId: string
  companyName: string
  synthetic: boolean
  period: { from: string; to: string; comparisonFrom: string; comparisonTo: string }
  scores: Score[]
  skillGaps: SkillGap[]
  evidence: Evidence[]
}

export interface AnalyzeRequest {
  companyId: string
  question?: string
}

export type ActionType = 'training' | 'software' | 'internal_tool'

export interface Action {
  id: string
  rank: number
  type: ActionType
  title: string
  department: string
  bullets: string[]
  pilot: string
  successMetric: string
  evidenceIds: string[]
}

export interface AnalyzeResponse {
  companyId: string
  summary: string
  actions: Action[]
  limitations: string[]
  mode: 'live' | 'demo'
}

export interface SlackPreviewResponse {
  text: string
}

export type DashboardWidget =
  | { type: 'metric'; label: string; value: string; note?: string }
  | { type: 'bar'; title: string; unit?: string; items: { label: string; value: number }[] }

export type Dashboard = { title: string; widgets: DashboardWidget[] }

export type ChatMessage = { role: 'user' | 'assistant'; content: string; dashboard?: Dashboard }

export type ChatRequest = { messages: { role: 'user' | 'assistant'; content: string }[] }

export type ChatResponse = { message: ChatMessage; mode: 'live' | 'demo' }
