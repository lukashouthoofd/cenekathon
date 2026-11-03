// Local chat backend for the frontend (POST /api/chat on port 8000). Logic lives in chat.mjs.
import { createServer } from 'node:http'
import { handle, env, MODEL, summaryText } from './chat.mjs'

const PORT = Number(env.PORT ?? 8000)

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 200_000) reject(new Error('Verzoek is te groot.'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        reject(new Error('Ongeldige JSON.'))
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const { status, body } = await handle(req.method, req.url, () => readBody(req))
  sendJson(res, status, body)
})

server.listen(PORT, () => {
  console.log(`chat backend op http://localhost:${PORT} (model ${MODEL}, data: ${summaryText ? 'ja' : 'nee'})`)
})
