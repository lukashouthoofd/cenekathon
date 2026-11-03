// Vercel serverless function: POST /api/chat. Logic lives in src/backend/chat.mjs.
import { handle } from '../src/backend/chat.mjs'

export default async function handler(req, res) {
  const { status, body } = await handle(req.method, '/api/chat', async () =>
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {}),
  )
  res.status(status).json(body)
}
