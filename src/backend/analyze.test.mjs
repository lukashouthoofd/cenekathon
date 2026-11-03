// Run: node --test src/backend/analyze.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeFor, analyzeHandle, slackPreviewHandle } from './analyze.mjs'
import { readinessFor } from './readiness.mjs'

const TYPES = new Set(['training', 'software', 'internal_tool'])
const bodyOf = (obj) => async () => obj

test('demo-bank returns 1 to 3 actions with ranks 1..n and allowed types', () => {
  const { status, body } = analyzeFor('demo-bank')
  assert.equal(status, 200)
  assert.equal(body.mode, 'live')
  assert.ok(body.actions.length >= 1 && body.actions.length <= 3)
  assert.deepEqual(body.actions.map((a) => a.rank), body.actions.map((_, i) => i + 1))
  for (const a of body.actions) assert.ok(TYPES.has(a.type), `unexpected type ${a.type}`)
})

test('unknown company id returns 404', async () => {
  const res = await analyzeHandle('POST', '/api/analyze', bodyOf({ companyId: 'onbekend' }))
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, { error: 'Onbekend bedrijf.' })
})

test('missing companyId returns 400', async () => {
  const res = await analyzeHandle('POST', '/api/analyze', bodyOf({}))
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: 'companyId ontbreekt.' })
})

test('every evidenceId in actions exists in the readiness evidence list', () => {
  const known = new Set(readinessFor('demo-bank').evidence.map((e) => e.id))
  const { body } = analyzeFor('demo-bank')
  for (const a of body.actions) {
    for (const id of a.evidenceIds) assert.ok(known.has(id), `unknown evidence ${id}`)
  }
})

test('limitations has 2 entries', () => {
  const { body } = analyzeFor('demo-bank')
  assert.equal(body.limitations.length, 2)
})

test('analyze route ignores non-matching paths', async () => {
  assert.equal(await analyzeHandle('GET', '/api/analyze', bodyOf({})), null)
  assert.equal(await analyzeHandle('POST', '/api/chat', bodyOf({})), null)
})

test('slack preview returns text for a known action and 404 otherwise', async () => {
  const ok = await slackPreviewHandle('POST', '/api/slack/preview', bodyOf({ companyId: 'demo-bank', actionId: 'act-1' }))
  assert.equal(ok.status, 200)
  assert.match(ok.body.text, /niet verzonden/)
  const bad = await slackPreviewHandle('POST', '/api/slack/preview', bodyOf({ companyId: 'demo-bank', actionId: 'act-9' }))
  assert.equal(bad.status, 404)
  assert.equal(await slackPreviewHandle('GET', '/api/slack/preview', bodyOf({})), null)
})
