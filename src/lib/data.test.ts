import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search, byRef, allRecords } from './data.ts';

test('every record has a unique ref', () => {
  const refs = allRecords().map((r) => r.ref);
  assert.equal(new Set(refs).size, refs.length);
});

test('search finds the matching market trend and internal skill', () => {
  const refs = search('kennisassistenten zoeksystemen').map((r) => r.ref);
  assert.ok(refs.includes('mt1'));
  assert.ok(refs.includes('is2'));
});

test('byRef returns the record or undefined', () => {
  assert.equal(byRef('sw1')?.name, 'Microsoft 365');
  assert.equal(byRef('nope'), undefined);
});
