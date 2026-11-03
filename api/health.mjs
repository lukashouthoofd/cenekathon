// Vercel serverless function: GET /api/health.
import { handle } from '../src/backend/chat.mjs'

export default async function handler(req, res) {
  const { status, body } = await handle(req.method, '/api/health')
  res.status(status).json(body)
}
