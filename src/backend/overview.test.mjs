// Run: node --test src/backend/overview.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { overviewFor, overviewHandle } from './overview.mjs'
import { readinessFor } from './readiness.mjs'

const OVERVIEW_KEYS = ['company', 'scores', 'gaps', 'software', 'refs', 'synthetic']

test('demo-bank returns an object with the Overview shape', () => {
  const { status, body } = overviewHandle('GET', '/api/overview')
  assert.equal(status, 200)
  assert.deepEqual(Object.keys(body).sort(), [...OVERVIEW_KEYS].sort())
  assert.equal(typeof body.company.name, 'string')
  assert.equal(typeof body.company.sector, 'string')
  assert.equal(typeof body.company.employees, 'number')
  assert.equal(body.scores.length, 3)
  for (const s of body.scores) {
    assert.deepEqual(Object.keys(s).sort(), ['coverage', 'dimension', 'explanation', 'value'])
    assert.equal(typeof s.coverage, 'string')
  }
  for (const g of body.gaps) assert.deepEqual(Object.keys(g).sort(), ['growthPct', 'internalPeople', 'ref', 'skill'])
  for (const s of body.software) assert.deepEqual(Object.keys(s).sort(), ['aiFeatures', 'name', 'ref', 'repetitiveHoursPerWeek', 'usedBy'])
  assert.equal(typeof body.refs, 'object')
  assert.equal(body.synthetic, true)
})

test('overview uses the demo-bank readiness scores', () => {
  const { body } = overviewFor('demo-bank')
  const scores = readinessFor('demo-bank').scores
  assert.deepEqual(body.scores.map((s) => s.dimension), scores.map((s) => s.dimension))
})

test('unknown company id returns 404 with the Dutch error', () => {
  const { status, body } = overviewFor('onbekend-bedrijf')
  assert.equal(status, 404)
  assert.deepEqual(body, { error: 'Onbekend bedrijf.' })
  const routed = overviewHandle('GET', '/api/overview?companyId=onbekend-bedrijf')
  assert.equal(routed.status, 404)
  assert.deepEqual(routed.body, { error: 'Onbekend bedrijf.' })
})

test('a null readiness score stays null in the output', () => {
  const r = readinessFor('demo-bank')
  const withNull = { ...r, scores: r.scores.map((s) => (s.dimension === 'ai_usage' ? { ...s, value: null } : s)) }
  const { body } = overviewFor('demo-bank', withNull)
  assert.equal(body.scores.find((s) => s.dimension === 'ai_usage').value, null)
  assert.equal(body.scores.find((s) => s.dimension === 'skills').value, r.scores.find((s) => s.dimension === 'skills').value)
})

test('non-matching paths and methods are not handled', () => {
  assert.equal(overviewHandle('POST', '/api/overview'), null)
  assert.equal(overviewHandle('GET', '/api/companies'), null)
})
