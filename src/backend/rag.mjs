// Client for the RAG service's POST /search_postings (src/rag/serve.py). Never throws:
// any error, timeout or non-200 response gives [] so chat falls back to the summary.

const MAX_CHARS = 4000
const EXCERPT_CHARS = 600

export async function searchPostings({ base, query, k = 6, timeoutMs = 8000, fetchImpl = fetch }) {
  try {
    const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/search_postings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, k }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return []
    const hits = await res.json()
    if (!Array.isArray(hits)) return []
    return hits
      .filter((h) => h && h.vacancy_id)
      .map((h) => ({
        vacancy_id: String(h.vacancy_id),
        title: String(h.title ?? ''),
        company: String(h.company ?? ''),
        date_posted: String(h.first_posted ?? ''),
        excerpt: String(h.text ?? ''),
      }))
  } catch {
    return []
  }
}

// One line per passage, at most MAX_CHARS characters in total.
export function formatPassages(list) {
  const lines = []
  let used = 0
  for (const p of list) {
    const excerpt = p.excerpt.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_CHARS)
    const line = `- [${p.vacancy_id}] ${p.title} bij ${p.company} (${p.date_posted}): ${excerpt}`
    if (used + line.length + 1 > MAX_CHARS) break
    lines.push(line)
    used += line.length + 1
  }
  return lines.join('\n')
}
