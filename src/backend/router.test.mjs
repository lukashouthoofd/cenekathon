// Run: node --test src/backend/router.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { routeRequest, companiesFromSummary } from './router.ts'

const opts = { fastModel: 'fast-m', strongModel: 'strong-m', knownCompanies: ['belfius', 'ing'] }

test('routeRequest: dashboard request routes strong with 2500 tokens', () => {
  const r = routeRequest('maak een dashboard', opts)
  assert.deepEqual(r, { model: 'strong-m', maxTokens: 2500, reason: 'dashboard', tier: 'strong' })
  assert.equal(routeRequest('Toon een GRAFIEK', opts).maxTokens, 2500)
})

test('routeRequest: company mention routes strong with 1500 tokens', () => {
  const r = routeRequest('Hoeveel vacatures heeft Belfius?', opts)
  assert.deepEqual(r, { model: 'strong-m', maxTokens: 1500, reason: 'company-or-trend', tier: 'strong' })
})

test('routeRequest: trend keyword routes strong with 1500 tokens', () => {
  const r = routeRequest('Wat is de groei van AI-skills?', opts)
  assert.equal(r.tier, 'strong')
  assert.equal(r.maxTokens, 1500)
})

test('routeRequest: company match is case-insensitive', () => {
  assert.equal(routeRequest('vacatures bij ING', opts).reason, 'company-or-trend')
  assert.equal(routeRequest('vacatures bij iNg', opts).reason, 'company-or-trend')
})

test('routeRequest: company names shorter than 3 characters are ignored', () => {
  const r = routeRequest('wat doet ab?', { ...opts, knownCompanies: ['ab'] })
  assert.equal(r.tier, 'fast')
})

test('routeRequest: simple question routes fast with 800 tokens', () => {
  const r = routeRequest('Wat is AI-readiness?', opts)
  assert.deepEqual(r, { model: 'fast-m', maxTokens: 800, reason: 'simple', tier: 'fast' })
})

test('routeRequest: empty string routes fast', () => {
  const r = routeRequest('', opts)
  assert.equal(r.tier, 'fast')
  assert.equal(r.model, 'fast-m')
  assert.equal(r.maxTokens, 800)
})

test('companiesFromSummary: valid input returns lowercase names', () => {
  const summary = { per_company: [{ company: 'Belfius' }, { company: 'ING' }, { other: 1 }] }
  assert.deepEqual(companiesFromSummary(summary), ['belfius', 'ing'])
})

test('companiesFromSummary: missing or malformed input returns []', () => {
  for (const input of [undefined, null, 'x', 42, {}, { per_company: 'nope' }, { per_company: [null, 3, { company: 7 }] }]) {
    assert.deepEqual(companiesFromSummary(input), [])
  }
})
