import company from '../../data/company.json' with { type: 'json' };

export type Company = typeof company;
export type Record = { ref: string; collection: string } & { [key: string]: unknown };

const COLLECTIONS = ['market_trends', 'internal_skills', 'software', 'training', 'tasks'] as const;

export const data: Company = company;

/** Every record with a stable reference like "mt1", so answers can cite their source. */
export function allRecords(source: Company = data): Record[] {
  return COLLECTIONS.flatMap((collection) =>
    (source[collection] as { id: string }[]).map((row) => ({ ...row, ref: row.id, collection })),
  );
}

/** Keyword search: records ranked by how many query words they contain. */
export function search(query: string, source: Company = data, limit = 5): Record[] {
  const words = query.toLowerCase().split(/\W+/u).filter((w) => w.length > 2);
  return allRecords(source)
    .map((record) => {
      const text = JSON.stringify(record).toLowerCase();
      return { record, hits: words.filter((w) => text.includes(w)).length };
    })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((r) => r.record);
}

export function byRef(ref: string, source: Company = data): Record | undefined {
  return allRecords(source).find((r) => r.ref === ref);
}
