// Deterministic follow-up question suggestions for the chat. No LLM call.
// Rules are applied in order (first match adds), then deduped, then anything equal to the user text is dropped.
// Returns at most 3 Dutch questions.

const MAX = 3

const SKILLS = ['Python', 'SQL', 'machine learning', 'prompt engineering', 'cloud', 'modelmonitoring', 'data governance', 'ai act']

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Case-insensitive match that does not match inside a longer word (letters only, so Dutch letters count).
const mentions = (text, term) =>
  new RegExp(`(?<!\\p{L})${escapeRegex(term)}(?!\\p{L})`, 'iu').test(text)

export function suggestFollowUps({ userText, replyText, hasDashboard, companies } = {}) {
  const user = typeof userText === 'string' ? userText : ''
  const reply = typeof replyText === 'string' ? replyText : ''
  const text = `${user}\n${reply}`
  if (text.trim() === '') return []
  const normalizedUser = user.trim().toLowerCase()
  const out = []
  const add = (q) => {
    if (q.toLowerCase() !== normalizedUser && !out.includes(q)) out.push(q)
  }

  if (Array.isArray(companies)) {
    for (const name of companies) {
      if (typeof name !== 'string' || name.trim() === '') continue
      const company = name.trim()
      if (!mentions(text, company)) continue
      add(`Hoe staat ${company} er voor op AI-gebruik?`)
      add(`Maak een dashboard van ${company}`)
    }
  }

  for (const skill of SKILLS) {
    if (!mentions(text, skill)) continue
    add(`Hoeveel vacatures noemen ${skill} in 2025?`)
    add(`Hoe ontwikkelt het aantal vacatures met ${skill} zich per jaar?`)
  }

  if (hasDashboard === true) add('Wat moet HR als eerste doen?')

  if (out.length < MAX) add('Welke skills missen we het meest bij Goldman Stanley?')
  if (out.length < MAX) add('Welke vacatures vragen om AI-skills in 2025?')

  return out.slice(0, MAX)
}
