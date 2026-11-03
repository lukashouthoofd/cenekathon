// Chooses the model tier and token budget for one chat request.
// Erasable TypeScript only (runs directly on Node 24 via type stripping). No dependencies.

export type Route = { model: string; maxTokens: number; reason: string; tier: 'fast' | 'strong' }

export interface RouteOptions {
  fastModel: string
  strongModel: string
  knownCompanies: string[]
}

const DASHBOARD_WORDS = ['dashboard', 'grafiek', 'overzicht', 'visualisatie']
const TREND_WORDS = ['vergelijk', 'vergelijking', 'benchmark', 'trend', 'groei', 'ontwikkeling']

export function routeRequest(lastUserText: string, options: RouteOptions): Route {
  const text = String(lastUserText ?? '').toLowerCase()

  if (DASHBOARD_WORDS.some((w) => text.includes(w))) {
    return { model: options.strongModel, maxTokens: 2500, reason: 'dashboard', tier: 'strong' }
  }

  const companyHit = options.knownCompanies.some((c) => {
    const name = String(c).toLowerCase()
    return name.length >= 3 && text.includes(name)
  })
  if (companyHit || TREND_WORDS.some((w) => text.includes(w))) {
    return { model: options.strongModel, maxTokens: 1500, reason: 'company-or-trend', tier: 'strong' }
  }

  return { model: options.fastModel, maxTokens: 800, reason: 'simple', tier: 'fast' }
}

// Reads summary.per_company[].company and returns the names in lowercase. Never throws.
export function companiesFromSummary(summary: unknown): string[] {
  try {
    const perCompany = (summary as { per_company?: unknown } | null)?.per_company
    if (!Array.isArray(perCompany)) return []
    const names: string[] = []
    for (const item of perCompany) {
      const company = (item as { company?: unknown } | null)?.company
      if (typeof company === 'string' && company.trim().length > 0) names.push(company.trim().toLowerCase())
    }
    return names
  } catch {
    return []
  }
}
