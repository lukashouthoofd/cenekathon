// Run: node --test src/backend/
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readinessFor, readinessHandle } from './readiness.mjs'

const bank = JSON.parse(readFileSync(new URL('./mock/internal-bank.json', import.meta.url), 'utf8'))

test('demo-bank readiness has 3 scores', () => {
  const r = readinessFor('demo-bank')
  assert.equal(r.scores.length, 3)
  assert.deepEqual(r.scores.map((s) => s.dimension), ['skills', 'ai_usage', 'training'])
})

test('ai_usage is null only if fewer than 3 departments are measured', () => {
  const measured = bank.departments.filter((d) => d.employees_with_ai_tool_use_90d !== null).length
  const ai = readinessFor('demo-bank').scores.find((s) => s.dimension === 'ai_usage')
  assert.equal(ai.value === null, measured < 3)
})

test('skill with null internalCoverage stays null, never 0', () => {
  const gap = readinessFor('demo-bank').skillGaps.find((s) => s.skillId === 'data-governance')
  assert.equal(gap.internalCoverage, null)
})

test('skills score is a number between 0 and 100', () => {
  const skills = readinessFor('demo-bank').scores.find((s) => s.dimension === 'skills')
  assert.equal(typeof skills.value, 'number')
  assert.ok(skills.value >= 0 && skills.value <= 100)
})

test('unknown company gives 404 with Dutch error', () => {
  assert.deepEqual(readinessHandle('GET', '/api/companies/nope/readiness'), {
    status: 404,
    body: { error: 'Onbekend bedrijf.' },
  })
})

test('readiness includes softwareGaps array (contract)', () => {
  const r = readinessFor('demo-bank')
  assert.ok(Array.isArray(r.softwareGaps) && r.softwareGaps.length > 0)
})
