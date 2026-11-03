import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { searchVacancies, vacancyTrend } from './vacancies.ts';

// Tiny synthetic DB with the schema of src/data/build_duckdb.py.
const path = join(mkdtempSync(join(tmpdir(), 'vac-')), 'test.duckdb');

before(async () => {
  const db = await DuckDBInstance.create(path);
  const conn = await db.connect();
  await conn.run(`CREATE TABLE vacancies (vacancy_id VARCHAR, title VARCHAR, company VARCHAR, description VARCHAR,
    date_posted DATE, country VARCHAR, city VARCHAR, possible_duplicate BOOLEAN)`);
  await conn.run(`INSERT INTO vacancies VALUES
    ('v1', 'Data Analyst', 'Bank A', 'Excel and SQL reporting', '2024-03-01', 'BE', 'Gent', false),
    ('v2', 'AI Engineer', 'Bank B', 'Build RAG pipelines with LLMs', '2024-06-01', 'NL', 'Amsterdam', false),
    ('v3', 'Klantenservice', 'Bank C', 'Klanten helpen', '2025-01-10', 'BE', 'Brussel', false),
    ('v4', 'GenAI Lead', 'Bank D', 'Lead our rag and agent team', '2025-05-02', 'UK', 'London', false),
    ('v5', 'GenAI Lead', 'Bank D', 'Lead our rag and agent team', '2025-05-02', 'UK', 'London', true)`);
  conn.closeSync();
  db.closeSync();
});

test('vacancyTrend counts matches per year, case-insensitive, without duplicates', async () => {
  assert.deepEqual(await vacancyTrend(['RAG'], path), [
    { year: 2024, total: 2, matching: 1, sharePct: 50 },
    { year: 2025, total: 2, matching: 1, sharePct: 50 },
  ]);
});

test('searchVacancies returns newest matches first with an excerpt', async () => {
  const rows = await searchVacancies(['rag', 'sql'], 5, path);
  assert.deepEqual(rows.map((r) => r.vacancy_id), ['v4', 'v2', 'v1']);
  assert.match(String(rows[0].excerpt), /rag/i);
});

test('terms match whole words only', async () => {
  // "AI" must not hit "Klantenservice"/"Data Analyst"; "rag" must not hit a word like "leverage".
  assert.deepEqual((await searchVacancies(['AI'], 5, path)).map((r) => r.vacancy_id), ['v2']);
  assert.deepEqual(await searchVacancies(['lev'], 5, path), []);
});

test('a missing database gives a clear error', async () => {
  await assert.rejects(vacancyTrend(['x'], 'nope.duckdb'), /niet gevonden/);
});
