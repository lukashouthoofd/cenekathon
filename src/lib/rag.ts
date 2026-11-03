import { connect } from './vacancies.ts';

// Built by src/data/build_rag.py. Not in git: derived from the licensed vacancy data.
const DEFAULT_PATH = process.env.RAG_DB_PATH ?? 'src/data/rag.duckdb';

export const KINDS = ['vacancy', 'skill', 'ai_exposure'] as const;
export type Kind = (typeof KINDS)[number];

/** BM25 full-text search over vacancies (2025-2026), ESCO skills and AI exposure per occupation, best match first. */
export async function searchKnowledge(query: string, kind?: Kind, limit = 8, path = DEFAULT_PATH) {
  if (!query.trim()) throw new Error('Geef een zoekvraag.');
  if (kind && !KINDS.includes(kind)) throw new Error(`Onbekende soort "${kind}". Kies uit: ${KINDS.join(', ')}.`);
  const conn = await connect(path);
  const reader = await conn.runAndReadAll(
    `SELECT ref, kind, title, company, country, date_posted, source, snippet, round(score, 2) AS score
     FROM (SELECT doc_id AS ref, kind, title, company, country, CAST(date_posted AS VARCHAR) AS date_posted, source,
                  left(text, 400) AS snippet, fts_main_docs.match_bm25(doc_id, ?) AS score
           FROM docs ${kind ? 'WHERE kind = ?' : ''})
     WHERE score IS NOT NULL ORDER BY score DESC LIMIT ?`,
    [query, ...(kind ? [kind] : []), Math.min(Math.max(limit, 1), 20)],
  );
  return reader.getRowObjectsJson();
}
