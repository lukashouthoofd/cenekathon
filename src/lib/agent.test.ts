import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runTool, splitSuggestions } from './agent.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const FALLBACK = { message: 'Semantische zoekdienst niet bereikbaar; gebruik searchVacancies.' };

test('semanticSearch and skillGap post the right body to the right path', async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    const json = url.endsWith('/search_postings') ? [{ vacancy_id: 'p1', title: 'AI Engineer', text: 'x'.repeat(2000) }] : { gaps: [] };
    return new Response(JSON.stringify(json), { status: 200 });
  }) as typeof fetch;

  const hits = (await runTool('semanticSearch', { query: 'kennisassistent', k: 3, country: 'BE' }, [])) as { text: string }[];
  const gap = await runTool('skillGap', { function: 'Risk' }, []);

  assert.equal(calls[0].url, 'http://localhost:8100/search_postings');
  assert.deepEqual(calls[0].body, { query: 'kennisassistent', k: 3, country: 'BE' });
  assert.equal(hits[0].text.length, 600);
  assert.equal(calls[1].url, 'http://localhost:8100/skill_gap');
  assert.deepEqual(calls[1].body, { function: 'Risk' });
  assert.deepEqual(gap, { gaps: [] });
});

test('an unreachable RAG API returns the fallback message instead of throwing', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.deepEqual(await runTool('semanticSearch', { query: 'AI governance' }, []), FALLBACK);

  globalThis.fetch = (async () => new Response('down', { status: 502 })) as typeof fetch;
  assert.deepEqual(await runTool('skillGap', { job_title: 'Analist' }, []), FALLBACK);
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
