// Json-bot: Slack (Socket Mode) -> lokale chat-backend (POST /api/chat).
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
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

const CHAT_URL = process.env.CHAT_URL || 'http://localhost:8000/api/chat'
const MAX_CHARS = 2000
const ERROR_TEXT = 'Json kon het antwoord nu niet ophalen. Probeer het later opnieuw.'

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

async function handle(text, threadTs, say) {
  if (!text) return
  if (text.length > MAX_CHARS) {
    await say({ text: `Je bericht is te lang (maximaal ${MAX_CHARS} tekens). Stel je vraag korter.`, thread_ts: threadTs })
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

const app = new App({ token: BOT_TOKEN, appToken: APP_TOKEN, socketMode: true })

app.event('app_mention', async ({ event, say }) => {
  if (event.bot_id) return
  const text = (event.text || '').replace(/<@[^>]+>/g, '').trim()
  await handle(text, event.thread_ts || event.ts, say)
})

app.event('message', async ({ event, say }) => {
  if (event.channel_type !== 'im' || event.subtype || event.bot_id) return
  await handle((event.text || '').trim(), event.thread_ts || event.ts, say)
})

await app.start()
console.log('Json-bot draait in Socket Mode')
