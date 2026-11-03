// Run: node --test src/backend/
import test from 'node:test'
import assert from 'node:assert/strict'
import { handle, env, parseReply, validMessages } from './chat.mjs'

const block = (obj) => 'Kort.\n```json\n' + JSON.stringify(obj) + '\n```'
const metric = { type: 'metric', label: 'A', value: '1' }
const bar = { type: 'bar', title: 'T', items: [{ label: 'x', value: 1.5 }] }

test('parseReply: valid dashboard block', () => {
  const r = parseReply(block({ dashboard: { title: 'D', widgets: [metric, bar] } }))
  assert.equal(r.content, 'Kort.')
  assert.equal(r.dashboard.widgets.length, 2)
})

test('parseReply: invalid JSON falls back to text', () => {
  const r = parseReply('Hoi\n```json\n{kapot\n```')
  assert.equal(r.dashboard, undefined)
  assert.match(r.content, /Hoi/)
})

test('parseReply: no block returns text', () => {
  assert.deepEqual(parseReply(' gewoon tekst '), { content: 'gewoon tekst' })
})

test('parseReply: bad widgets are dropped', () => {
  const bad = [
    { type: 'pie', title: 'x' },
    { type: 'metric', label: 'A' },
    { type: 'bar', title: 'T', items: 'nope' },
    { type: 'bar', title: 'T', items: [{ label: 'x', value: '5' }] },
    { type: 'bar', title: 'T', items: [{ label: 'x', value: null }] },
  ]
  const r = parseReply(block({ dashboard: { title: 'D', widgets: [...bad, metric] } }))
  assert.deepEqual(r.dashboard.widgets, [metric])
})

test('parseReply: no valid widgets returns plain text', () => {
  const r = parseReply(block({ dashboard: { title: 'D', widgets: [{ type: 'pie' }] } }))
  assert.equal(r.dashboard, undefined)
})

test('validMessages', () => {
  assert.equal(validMessages([]), false)
  assert.equal(validMessages([{ role: 'system', content: 'x' }]), false)
  assert.equal(validMessages([{ role: 'user', content: 'x' }]), true)
})

test('handle: routes and errors', async (t) => {
  const savedKey = env.AI_API_KEY
  const savedFetch = globalThis.fetch
  t.after(() => {
    env.AI_API_KEY = savedKey
    globalThis.fetch = savedFetch
  })

  assert.equal((await handle('GET', '/nope', async () => ({}))).status, 404)

  env.AI_API_KEY = ''
  assert.equal((await handle('POST', '/api/chat', async () => ({}))).status, 500)

  env.AI_API_KEY = 'sk-test-SECRET'
  assert.equal((await handle('POST', '/api/chat', async () => ({ messages: [] }))).status, 400)

  globalThis.fetch = async () => {
    throw new Error('boom sk-test-SECRET')
  }
  const r = await handle('POST', '/api/chat', async () => ({ messages: [{ role: 'user', content: 'hoi' }] }))
  assert.equal(r.status, 502)
  assert.ok(!JSON.stringify(r.body).includes('sk-test-SECRET'))

  globalThis.fetch = async () => {
    throw new DOMException('timeout', 'TimeoutError')
  }
  const t2 = await handle('POST', '/api/chat', async () => ({ messages: [{ role: 'user', content: 'hoi' }] }))
  assert.equal(t2.status, 504)
})
