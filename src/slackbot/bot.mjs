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

export function detectRoute(text) {
  const t = text.toLowerCase()
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
  const route = detectRoute(text)
  if (route) {
    const id = remember(route, text)
    await say({ ...buildProposal(route, text, id), thread_ts: threadTs })
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
    await handle((event.text || '').trim(), event.thread_ts || event.ts, say)
  })

  app.action('approve_send', (args) => decide(args, true))
  app.action('cancel_send', (args) => decide(args, false))

  await app.start()
  console.log('Json-bot draait in Socket Mode')
}
