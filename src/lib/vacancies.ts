import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { existsSync } from 'node:fs';

// Built by src/data/build_duckdb.py (data team). Not in git: too large.
const DEFAULT_PATH = process.env.VACANCY_DB_PATH ?? 'src/data/vacancies.duckdb';

const connections = new Map<string, Promise<DuckDBConnection>>();

function connect(path: string): Promise<DuckDBConnection> {
  if (!existsSync(path)) throw new Error(`Vacaturedatabase niet gevonden (${path}). Vraag het data-team om vacancies.duckdb.`);
  if (!connections.has(path)) {
    connections.set(path, DuckDBInstance.create(path, { access_mode: 'READ_ONLY' }).then((db) => db.connect()));
  }
  return connections.get(path)!;
}

/**
 * Case-insensitive whole-word match of any term in title or description; returns SQL + its parameter values.
 * Whole words, because a substring search for "AI" also hits "claims" and "RAG" hits "leverage".
 */
function matchAny(terms: string[]) {
  const clean = terms.map((t) => t.trim()).filter(Boolean).slice(0, 8);
  if (clean.length === 0) throw new Error('Geef minstens één zoekterm.');
  const patterns = clean.map((t) => `(?i)\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const sql = clean.map(() => '(regexp_matches(title, ?) OR regexp_matches(description, ?))').join(' OR ');
  return { sql: `(${sql})`, values: patterns.flatMap((p) => [p, p]), first: clean[0] };
}

/** Per year: how many (non-duplicate) vacancies mention any of the terms, and their share of all vacancies. */
export async function vacancyTrend(terms: string[], path = DEFAULT_PATH) {
  const m = matchAny(terms);
  const conn = await connect(path);
  const reader = await conn.runAndReadAll(
    `SELECT CAST(year(date_posted) AS INTEGER) AS year,
            CAST(count(*) AS INTEGER) AS total,
            CAST(count(*) FILTER (WHERE ${m.sql}) AS INTEGER) AS matching
     FROM vacancies WHERE NOT possible_duplicate
     GROUP BY 1 ORDER BY 1`,
    m.values,
  );
  return reader.getRowObjectsJson().map((r) => {
    const { year, total, matching } = r as { year: number; total: number; matching: number };
    return { year, total, matching, sharePct: total ? Math.round((matching / total) * 10000) / 100 : null };
  });
}

/** Most recent example vacancies mentioning any of the terms, with an excerpt around the first term. */
export async function searchVacancies(terms: string[], limit = 5, path = DEFAULT_PATH) {
  const m = matchAny(terms);
  const conn = await connect(path);
  const reader = await conn.runAndReadAll(
    `SELECT vacancy_id, title, company, CAST(date_posted AS VARCHAR) AS date_posted, country, city,
            substr(description, greatest(1, strpos(lower(description), lower(?)) - 120), 360) AS excerpt
     FROM vacancies WHERE NOT possible_duplicate AND ${m.sql}
     ORDER BY date_posted DESC LIMIT ?`,
    [m.first, ...m.values, Math.min(Math.max(limit, 1), 10)],
  );
  return reader.getRowObjectsJson();
}
