import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { searchKnowledge } from './rag.ts';

// Tiny synthetic index with the schema of src/data/build_rag.py.
const path = join(mkdtempSync(join(tmpdir(), 'rag-')), 'test.duckdb');

before(async () => {
  const db = await DuckDBInstance.create(path);
  const conn = await db.connect();
  await conn.run(`CREATE TABLE docs (doc_id VARCHAR, kind VARCHAR, title VARCHAR, text VARCHAR, company VARCHAR,
    country VARCHAR, date_posted DATE, source VARCHAR)`);
  await conn.run(`INSERT INTO docs VALUES
    ('v1', 'vacancy', 'Claims Handler', 'Handle insurance claims with our new AI assistant', 'Bank A', 'BE', '2025-03-01', NULL),
    ('v2', 'vacancy', 'Data Analyst', 'SQL and Excel reporting', 'Bank B', 'NL', '2026-01-10', NULL),
    ('esco:1', 'skill', 'prompt engineering', 'prompt-engineering | ingénierie de requête', NULL, NULL, NULL, 'ESCO')`);
  await conn.run(`INSTALL fts; LOAD fts; PRAGMA create_fts_index('docs', 'doc_id', 'title', 'text', stemmer = 'english', strip_accents = 1)`);
  conn.closeSync();
  db.closeSync();
});

test('searchKnowledge ranks matching docs and skips non-matches', async () => {
  const rows = await searchKnowledge('insurance claims', undefined, 5, path);
  assert.deepEqual(rows.map((r) => r.ref), ['v1']);
});

test('searchKnowledge filters on kind', async () => {
  assert.deepEqual((await searchKnowledge('prompt', 'skill', 5, path)).map((r) => r.ref), ['esco:1']);
  assert.deepEqual(await searchKnowledge('prompt', 'vacancy', 5, path), []);
});

test('searchKnowledge rejects an empty query', async () => {
  await assert.rejects(searchKnowledge('  ', undefined, 5, path), /zoekvraag/);
});
