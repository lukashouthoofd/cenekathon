// The single API adapter. Components never call fetch or import fixtures directly.
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  CompaniesResponse,
  Company,
  Readiness,
  SlackPreviewResponse,
} from './types'
import { demoChatReply } from './fixtures/chat'
import { demoAnalyze, demoCompanies, demoReadiness, demoSlackPreview } from './fixtures'

export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === 'true'
// The chat backend exists before the dashboard endpoints do: let the chat go live on its own.
export const LIVE_CHAT: boolean = import.meta.env.VITE_LIVE_CHAT === 'true'

const BASE: string = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const delay = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 300))

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Kan de server niet bereiken. Controleer je verbinding en probeer het opnieuw.')
  }
  if (!res.ok) {
    throw new ApiError(`De server gaf een fout terug (HTTP ${res.status}). Probeer het later opnieuw.`, res.status)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('Het antwoord van de server kon niet worden gelezen.', res.status)
  }
}

function demoLookup<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new ApiError(`${what} niet gevonden in de demodata.`, 404)
  return value
}

export async function getCompanies(): Promise<Company[]> {
  if (DEMO_MODE) {
    await delay()
    return demoCompanies
  }
  return (await request<CompaniesResponse>('/api/companies')).companies
}

export async function getReadiness(id: string): Promise<Readiness> {
  if (DEMO_MODE) {
    await delay()
    return demoLookup(demoReadiness[id], 'Bedrijf')
  }
  return request<Readiness>(`/api/companies/${encodeURIComponent(id)}/readiness`)
}

export async function analyze(companyId: string, question?: string): Promise<AnalyzeResponse> {
  if (DEMO_MODE) {
    await delay()
    return demoLookup(demoAnalyze[companyId], 'Bedrijf')
  }
  const body: AnalyzeRequest = { companyId, ...(question ? { question } : {}) }
  return request<AnalyzeResponse>('/api/analyze', body)
}

export async function getSlackPreview(companyId: string, actionId: string): Promise<string> {
  if (DEMO_MODE) {
    await delay()
    return demoSlackPreview(companyId, actionId)
  }
  return (await request<SlackPreviewResponse>('/api/slack/preview', { companyId, actionId })).text
}

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  if (DEMO_MODE && !LIVE_CHAT) {
    await delay()
    return demoChatReply(messages)
  }
  const body: ChatRequest = { messages: messages.map(({ role, content }) => ({ role, content })) }
  return request<ChatResponse>('/api/chat', body)
}
