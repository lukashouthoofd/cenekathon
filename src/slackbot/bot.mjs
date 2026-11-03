// Json-bot: Slack (Socket Mode) -> lokale chat-backend (POST /api/chat).
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import pkg from '@slack/bolt'

const { App } = pkg

// Laad KEY=VALUE uit de .env in de repo-root (of ENV_FILE). Waarden worden nooit gelogd.
const envFile = process.env.ENV_FILE || resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m || line.trimStart().startsWith('#')) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const CHAT_URL = process.env.CHAT_URL || 'http://localhost:8000/api/chat'
const MAX_CHARS = 2000
const ERROR_TEXT = 'Json kon het antwoord nu niet ophalen. Probeer het later opnieuw.'
export const WELCOME_TEXT =
  "Hoi, ik ben Json. Ik beantwoord vragen over AI-readiness en vacatures bij financiële bedrijven. De bedrijfscijfers zijn gesimuleerd. Typ 'hulp' voor voorbeeldvragen, of stel gewoon je vraag."
export const HELP_TEXT = [
  "Voorbeeldvragen (typ 'hulp' om deze lijst weer te zien):",
  '- Welke skills missen we het meest bij Bank Vandermeulen?',
  '- Hoe staat Bank Vandermeulen er voor op AI-gebruik?',
  '- Welke vacatures vragen om AI-skills in 2025?',
  '- Hoeveel vacatures noemen Python in 2025?',
  '- Stuur de skill-gaps naar HR',
  '- Wat moet HR als eerste doen?',
  '',
  'Voor HR: een voorstel naar het HR-kanaal gaat pas na jouw klik op Verstuur.',
].join('\n')
const seenUsers = new Set() // Slack-gebruikers die al een welkom hebben gehad, in geheugen

// Goedkeuringsflow: Json stelt een bericht voor aan een team en verstuurt pas na een klik.
const CHANNELS = {
  HR: process.env.SLACK_CHANNEL_HR,
  ENGINEERING: process.env.SLACK_CHANNEL_ENGINEERING,
  IT: process.env.SLACK_CHANNEL_IT,
}
const TEAM_NAMES = { HR: 'HR', ENGINEERING: 'Engineering', IT: 'IT' }
const ROUTE_KEYWORDS = [
  ['HR', ['vacature', 'aannemen', 'hire', 'werving']],
  ['ENGINEERING', ['interne tool', 'bouwen', 'engineering']],
  ['IT', ['software', 'kopen', 'licentie', 'tool kopen']],
]
const PROPOSAL_MAX_CHARS = 800
const PENDING_MAX = 200
const pending = new Map() // korte id -> { route, text }, in geheugen

function dashboardSummary(dashboard) {
  const lines = [dashboard.title]
  for (const w of dashboard.widgets) {
    if (w.type === 'metric') lines.push(`${w.label}: ${w.value}`)
    if (w.type === 'bar') {
      lines.push(w.title)
      for (const i of w.items) lines.push(`${i.label}: ${i.value}${w.unit ? ` ${w.unit}` : ''}`)
    }
  }
  return lines.join('\n')
}

async function ask(text) {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    console.error(`Chat-backend gaf status ${res.status}.`)
    return ERROR_TEXT
  }
  const { message } = await res.json()
  const parts = [message?.content || 'Geen antwoord.']
  if (message?.dashboard) parts.push(dashboardSummary(message.dashboard))
  return parts.join('\n\n')
}

const HR_COMPANY_ID = 'demo-bank'
const HR_TIMEOUT_MS = 10_000

export function isHrSummaryRequest(text) {
  const t = text.toLowerCase()
  const skillGaps = t.includes('skill') && (t.includes('gap') || t.includes('hiaten')) && (t.includes('hr') || t.includes('stuur'))
  const vacatures = t.includes('vacature') && t.includes('hr') && t.includes('stuur')
  return skillGaps || vacatures
}

const percentOrUnknown = (v) => (v === null || v === undefined ? 'onbekend' : `${Math.round(v * 100)}%`)

export function buildHrSummary(readiness, analyze) {
  const lines = [`Skill-gaps voor ${readiness.companyName} (gesimuleerd)`]
  for (const g of readiness.skillGaps) {
    lines.push(`- ${g.name} (${g.department}): markt ${percentOrUnknown(g.marketShare)}, intern ${percentOrUnknown(g.internalCoverage)}`)
  }
  const actions = analyze?.actions ?? []
  if (actions.length) {
    lines.push('Voorgestelde acties:')
    for (const a of actions) lines.push(`- ${a.title}`)
  }
  const text = lines.join('\n')
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
}

async function fetchHrSummary() {
  const base = new URL(CHAT_URL).origin
  const get = async (path, init) => {
    const res = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(HR_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return res.json()
  }
  const readiness = await get(`/api/companies/${HR_COMPANY_ID}/readiness`)
  const analyze = await get('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyId: HR_COMPANY_ID }),
  }).catch(() => null)
  return buildHrSummary(readiness, analyze)
}

// Een route vraagt een expliciete actie (sturen/aanvragen) plus een onderwerp. Vragen en losse statements zijn nooit een route.
const ROUTE_ACTION = /\b(verstuur|stuur|meld|aanvra\w*)\b|\bwil graag\b|\bkun je\b.*\bnaar\b|\bzet\b.*\bdoor\b|\bvraag\b.*\baan\b/
const QUESTION_START = /^(welke|hoeveel|hoe|wat|waarom|wanneer|wie|maak een dashboard)\b/

export function detectRoute(text) {
  const t = text.trim().toLowerCase()
  if (t.endsWith('?') || QUESTION_START.test(t)) return null
  if (!ROUTE_ACTION.test(t)) return null
  const hit = ROUTE_KEYWORDS.find(([, words]) => words.some((w) => t.includes(w)))
  return hit ? hit[0] : null
}

export function buildProposal(route, text, id, channels = CHANNELS) {
  const team = TEAM_NAMES[route]
  const configured = Boolean(channels[route])
  let body = `Voorstel voor ${team}: ${text.slice(0, PROPOSAL_MAX_CHARS)}`
  if (!configured) body += `\n\nHet kanaal voor ${team} is niet ingesteld (SLACK_CHANNEL_${route}), dus dit kan nu niet verstuurd worden.`
  const actions = []
  if (configured) {
    actions.push({
      type: 'button',
      action_id: 'approve_send',
      style: 'primary',
      text: { type: 'plain_text', text: `Verstuur naar ${team}` },
      value: `${id}|${route}`,
    })
  }
  actions.push({
    type: 'button',
    action_id: 'cancel_send',
    text: { type: 'plain_text', text: 'Annuleer' },
    value: `${id}|${route}`,
  })
  return {
    text: body,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: body } },
      { type: 'actions', elements: actions },
    ],
  }
}

function remember(route, text) {
  const id = randomUUID().slice(0, 8)
  if (pending.size >= PENDING_MAX) pending.delete(pending.keys().next().value)
  pending.set(id, { route, text })
  return id
}

async function handle(text, threadTs, say) {
  if (!text) return
  if (text.length > MAX_CHARS) {
    await say({ text: `Je bericht is te lang (maximaal ${MAX_CHARS} tekens). Stel je vraag korter.`, thread_ts: threadTs })
    return
  }
  if (isHrSummaryRequest(text)) {
    let summary
    try {
      summary = await fetchHrSummary()
    } catch (e) {
      console.error(`Backend niet bereikbaar (${e?.name || 'fout'}).`)
      await say({ text: 'Backend niet bereikbaar. Probeer het later opnieuw.', thread_ts: threadTs })
      return
    }
    const id = remember('HR', summary)
    await say({ ...buildProposal('HR', summary, id), thread_ts: threadTs })
    return
  }
  const route = detectRoute(text)
  if (route) {
    const id = remember(route, text)
    await say({ ...buildProposal(route, text, id), thread_ts: threadTs })
    return
  }
  if (/\bhulp\b/i.test(text)) {
    await say({ text: HELP_TEXT, thread_ts: threadTs })
    return
  }
  let reply
  try {
    reply = await ask(text)
  } catch (e) {
    console.error(`Chat-backend niet bereikbaar (${e?.name || 'fout'}).`)
    reply = ERROR_TEXT
  }
  await say({ text: reply, thread_ts: threadTs })
}

async function decide({ ack, action, body, client }, approve) {
  await ack()
  const [id, route] = (action.value || '').split('|')
  const entry = pending.get(id)
  if (!Object.hasOwn(TEAM_NAMES, route) || entry?.route !== route) return
  pending.delete(id)
  const team = TEAM_NAMES[route]
  let status = 'Geannuleerd'
  if (approve) {
    try {
      await client.chat.postMessage({
        channel: CHANNELS[route],
        text: `Van Json, goedgekeurd door ${body.user?.name || 'een teamlid'}: ${entry.text}`,
      })
      status = `Verzonden naar ${team}`
    } catch (e) {
      console.error(`Versturen naar ${team} mislukt (${e?.data?.error || e?.name || 'fout'}).`)
      status = `Versturen naar ${team} is mislukt. Is de bot uitgenodigd in dat kanaal?`
    }
  }
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: status,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: status } }],
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const APP_TOKEN = process.env.SLACK_APP_TOKEN
  const BOT_TOKEN = process.env.SLACK_BOT_TOKEN
  if (!APP_TOKEN?.startsWith('xapp-')) {
    console.error('SLACK_APP_TOKEN ontbreekt of heeft het verkeerde formaat (moet beginnen met xapp-). Zet hem in .env.')
    process.exit(1)
  }
  if (!BOT_TOKEN?.startsWith('xoxb-')) {
    console.error('SLACK_BOT_TOKEN ontbreekt of heeft het verkeerde formaat (moet beginnen met xoxb-). Zet hem in .env.')
    process.exit(1)
  }

  const app = new App({ token: BOT_TOKEN, appToken: APP_TOKEN, socketMode: true })
  // Log only the event type and channel type, never the message text, so missing events are easy to diagnose.
  app.use(async ({ body, next }) => {
    console.log(`event: ${body?.event?.type ?? body?.type ?? 'unknown'} channel_type=${body?.event?.channel_type ?? '-'}`)
    await next()
  })

  app.event('app_mention', async ({ event, say }) => {
    if (event.bot_id) return
    const text = (event.text || '').replace(/<@[^>]+>/g, '').trim()
    await handle(text, event.thread_ts || event.ts, say)
  })

  app.event('message', async ({ event, say }) => {
    if (event.channel_type !== 'im' || event.subtype || event.bot_id) return
    const threadTs = event.thread_ts || event.ts
    if (!seenUsers.has(event.user)) {
      seenUsers.add(event.user)
      await say({ text: WELCOME_TEXT, thread_ts: threadTs })
    }
    await handle((event.text || '').trim(), threadTs, say)
  })

  app.action('approve_send', (args) => decide(args, true))
  app.action('cancel_send', (args) => decide(args, false))

  await app.start()
  console.log('Json-bot draait in Socket Mode')
}
