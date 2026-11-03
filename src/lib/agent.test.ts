import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runTool, splitSuggestions } from './agent.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const FALLBACK = { message: 'RAG-API niet bereikbaar; gebruik searchVacancies en vacancyTrend.' };

test('search_postings, top_skills and skill_gap post the right body to the right path', async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    const json = url.endsWith('/search_postings') ? [{ vacancy_id: 'p1', title: 'AI Engineer', text: 'x'.repeat(2000) }] : { gaps: [] };
    return new Response(JSON.stringify(json), { status: 200 });
  }) as typeof fetch;

  const hits = (await runTool('search_postings', { query: 'kennisassistent', k: 3, country: 'BE' }, [])) as { text: string }[];
  const gap = await runTool('skill_gap', { function: 'Risk' }, []);
  await runTool('top_skills', { country: 'NL', title_contains: 'risk' }, []);

  assert.equal(calls[0].url, 'http://localhost:8100/search_postings');
  assert.deepEqual(calls[0].body, { query: 'kennisassistent', k: 3, country: 'BE' });
  assert.equal(hits[0].text.length, 600);
  assert.equal(calls[1].url, 'http://localhost:8100/skill_gap');
  assert.deepEqual(calls[1].body, { function: 'Risk' });
  assert.deepEqual(gap, { gaps: [] });
  assert.equal(calls[2].url, 'http://localhost:8100/top_skills');
  assert.deepEqual(calls[2].body, { country: 'NL', title_contains: 'risk' });
});

test('an unreachable RAG API returns the fallback message instead of throwing', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.deepEqual(await runTool('top_skills', { country: 'BE' }, []), FALLBACK);

  globalThis.fetch = (async () => new Response('down', { status: 502 })) as typeof fetch;
  assert.deepEqual(await runTool('skill_gap', { job_title: 'Analist' }, []), FALLBACK);
});

test('a 4xx from the RAG API is reported as bad input, not as "down"', async () => {
  globalThis.fetch = (async () => new Response('{"detail":"k too big"}', { status: 422 })) as typeof fetch;
  const res = (await runTool('top_skills', { country: 'BE' }, [])) as { error: string };
  assert.match(res.error, /HTTP 422/);
});

test('k is clamped to the RAG API limits', async () => {
  const bodies: { k?: number }[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    return new Response('[]', { status: 200 });
  }) as typeof fetch;
  await runTool('search_postings', { query: 'x', k: 500 }, []);
  await runTool('top_skills', { k: 999 }, []);
  await runTool('skill_gap', { function: 'Risk', k: 0 }, []);
  assert.deepEqual(bodies.map((b) => b.k), [50, 200, 1]);
});

test('search_postings never throws when both the RAG API and the vacancy DB are unreachable', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const prev = process.env.VACANCY_DB_PATH;
  process.env.VACANCY_DB_PATH = 'does-not-exist.duckdb';
  try {
    const res = (await runTool('search_postings', { query: 'kennisassistent voor banken' }, [])) as unknown;
    assert.ok(res !== undefined);
  } finally {
    if (prev === undefined) delete process.env.VACANCY_DB_PATH; else process.env.VACANCY_DB_PATH = prev;
  }
});

test('splitSuggestions takes the trailing follow-up line off the reply', () => {
  assert.deepEqual(splitSuggestions('Antwoord.\n\nVervolgvragen: Welke opleiding? | Wie aanwerven? | Welke software?\n'), {
    content: 'Antwoord.',
    suggestions: ['Welke opleiding?', 'Wie aanwerven?', 'Welke software?'],
  });
  assert.deepEqual(splitSuggestions('Antwoord.\n**Vervolgvragen:** A? | B?'), { content: 'Antwoord.', suggestions: ['A?', 'B?'] });
  assert.deepEqual(splitSuggestions('Ik ben JSON, ik kan daar niet op antwoorden.'), {
    content: 'Ik ben JSON, ik kan daar niet op antwoorden.',
    suggestions: [],
  });
});
