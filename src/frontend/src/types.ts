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

export interface SoftwareGap {
  id: string
  department: string
  /** The task or skill gap the software should support. */
  need: string
  currentTool: string
  aiStatus: string
  /** Type of software proposed (no brand names). */
  suggestion: string
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
  softwareGaps: SoftwareGap[]
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

/** A vacancy the chat agent wrote for the company (subset of VacancyDraft in src/lib/vacancyDoc.ts). */
export type ProposedVacancy = {
  title: string
  department: string
  intro: string
  basedOn?: string[]
  linkedinSearch?: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  dashboard?: Dashboard
  /** Vacancies proposed in this reply, per Word document. Only sent by the agent backend. */
  proposed?: { documentId: string; vacancies: ProposedVacancy[] }[]
  /** Follow-up questions the user can click. Only sent by the agent backend. */
  suggestions?: string[]
}

export type ChatRequest = { messages: { role: 'user' | 'assistant'; content: string }[] }

export type ChatResponse = { message: ChatMessage; mode: 'live' | 'demo' }

/** GET /api/overview: the company the chat agent reasons over (side panel next to the chat). */
export type Overview = {
  company: { name: string; sector: string; employees: number }
  scores: { dimension: string; value: number | null; explanation: string; coverage: string }[]
  gaps: { skill: string; growthPct: number; internalPeople: number; ref: string }[]
  software: { name: string; usedBy: string; aiFeatures: string; repetitiveHoursPerWeek: number; ref: string }[]
  /** Readable label per source reference (e.g. "is3"), used to explain citations in chat replies. */
  refs: Record<string, string>
  synthetic: boolean
}
