// Run: node --test src/backend/suggestions.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestFollowUps } from './suggestions.mjs'

const companies = ['Bank Vandermeulen']

test('suggestFollowUps: company mention yields the two company questions', () => {
  const r = suggestFollowUps({ userText: 'Hoe gaat het bij bank vandermeulen?', replyText: '', hasDashboard: false, companies })
  assert.deepEqual(r, [
    'Hoe staat Bank Vandermeulen er voor op AI-gebruik?',
    'Maak een dashboard van Bank Vandermeulen',
    'Welke skills missen we het meest bij Bank Vandermeulen?',
  ])
})

test('suggestFollowUps: skill mention yields two skill questions', () => {
  const r = suggestFollowUps({ userText: 'Wat vragen banken over python?', replyText: '', hasDashboard: false, companies: [] })
  assert.deepEqual(r, [
    'Hoeveel vacatures noemen Python in 2025?',
    'Hoe ontwikkelt het aantal vacatures met Python zich per jaar?',
    'Welke skills missen we het meest bij Bank Vandermeulen?',
  ])
})

test('suggestFollowUps: dashboard adds the HR question', () => {
  const r = suggestFollowUps({ userText: 'x', replyText: 'y', hasDashboard: true, companies: [] })
  assert.ok(r.includes('Wat moet HR als eerste doen?'))
})

test('suggestFollowUps: never more than 3, no duplicates, never equal to userText', () => {
  const userText = 'Maak een dashboard van Bank Vandermeulen over Python en SQL'
  const r = suggestFollowUps({
    userText,
    replyText: 'cloud, machine learning, Bank Vandermeulen, AI act',
    hasDashboard: true,
    companies,
  })
  assert.equal(r.length, 3)
  assert.equal(new Set(r).size, r.length)
  assert.ok(r.every((q) => q.toLowerCase() !== userText.toLowerCase()))

  const same = suggestFollowUps({
    userText: 'Welke vacatures vragen om AI-skills in 2025?',
    replyText: '',
    hasDashboard: false,
    companies: [],
  })
  assert.ok(!same.includes('Welke vacatures vragen om AI-skills in 2025?'))
  assert.ok(same.length <= 3)
})

test('suggestFollowUps: empty or non-string input returns []', () => {
  assert.deepEqual(suggestFollowUps({ userText: '', replyText: '', hasDashboard: false, companies: [] }), [])
  assert.deepEqual(suggestFollowUps(), [])
  assert.deepEqual(suggestFollowUps({ userText: null, replyText: 42, hasDashboard: 'yes', companies: 'x' }), [])
})
