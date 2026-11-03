// Run: node --test src/backend/rag.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { searchPostings, formatPassages } from './rag.mjs'

const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

test('searchPostings: [] on a rejected fetch', async () => {
  const out = await searchPostings({
    base: 'http://rag.local',
    query: 'x',
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED')
    },
  })
  assert.deepEqual(out, [])
})

test('searchPostings: [] on a non-200 response', async () => {
  const out = await searchPostings({ base: 'http://rag.local', query: 'x', fetchImpl: async () => jsonRes(500, {}) })
  assert.deepEqual(out, [])
})

test('searchPostings: [] on timeout', async () => {
  const out = await searchPostings({
    base: 'http://rag.local',
    query: 'x',
    timeoutMs: 10,
    fetchImpl: (_url, opts) =>
      new Promise((_resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason))),
  })
  assert.deepEqual(out, [])
})

test('searchPostings: POSTs query and k, normalises passages', async () => {
  let seen
  const hits = [
    { vacancy_id: 'V1', chunk_idx: 0, title: 'Data analist', company: 'ING', country: 'NL', city: 'Amsterdam', first_posted: '2025-03-01', score: 0.9, text: 'Excel en SQL.' },
    { title: 'geen id' },
  ]
  const out = await searchPostings({
    base: 'http://rag.local/',
    query: 'SQL',
    k: 3,
    fetchImpl: async (url, opts) => {
      seen = { url, body: JSON.parse(opts.body), method: opts.method }
      return jsonRes(200, hits)
    },
  })
  assert.equal(seen.url, 'http://rag.local/search_postings')
  assert.equal(seen.method, 'POST')
  assert.deepEqual(seen.body, { query: 'SQL', k: 3 })
  assert.deepEqual(out, [
    { vacancy_id: 'V1', title: 'Data analist', company: 'ING', date_posted: '2025-03-01', excerpt: 'Excel en SQL.' },
  ])
})

test('formatPassages: contains vacancy_id and stays under 4000 characters for 50 long passages', () => {
  const list = Array.from({ length: 50 }, (_, i) => ({
    vacancy_id: `VAC${i}`,
    title: 'Titel '.repeat(20),
    company: 'Bedrijf',
    date_posted: '2025-01-01',
    excerpt: 'lorem ipsum dolor sit amet '.repeat(100),
  }))
  const text = formatPassages(list)
  assert.ok(text.length <= 4000, `length ${text.length}`)
  assert.match(text, /\[VAC0\]/)
})
