import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVacancyDocument, saveVacancyDocument } from './vacancyDoc.ts';

const draft = {
  title: 'AI-kennisassistent specialist',
  department: 'Klantenservice',
  intro: 'Je bouwt mee aan onze kennisassistent.',
  responsibilities: ['Procedures ontsluiten'],
  requirements: ['Ervaring met RAG'],
  offer: ['Opleidingsbudget'],
  basedOn: ['v2'],
};

test('a saved document can be read back as a .docx (zip) file', async () => {
  const id = await saveVacancyDocument('Testbedrijf', [draft]);
  const file = readVacancyDocument(id);
  assert.ok(file && file.length > 1000);
  assert.equal(file.subarray(0, 2).toString(), 'PK');
});

test('unknown or malicious ids return nothing', () => {
  assert.equal(readVacancyDocument('../../etc/passwd'), undefined);
  assert.equal(readVacancyDocument('00000000-0000-0000-0000-000000000000'), undefined);
});

test('an empty vacancy list is rejected', async () => {
  await assert.rejects(saveVacancyDocument('Testbedrijf', []), /minstens één/);
});
