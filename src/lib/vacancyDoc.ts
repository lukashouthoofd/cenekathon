import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type VacancyDraft = {
  title: string;
  department: string;
  intro: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave?: string[];
  offer: string[];
  /** Ids of real market vacancies this draft is based on. */
  basedOn?: string[];
};

// Files on disk (not in memory) so the download route can read them from any route bundle.
const DIR = join(tmpdir(), 'ai-readiness-vacatures');
const ID = /^[0-9a-f-]{36}$/;

function list(title: string, items: string[] = []) {
  if (items.length === 0) return [];
  return [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_3 }),
    ...items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
  ];
}

export async function buildVacancyDocx(company: string, vacancies: VacancyDraft[]): Promise<Buffer> {
  const doc = new Document({
    creator: 'AI-readiness agent',
    title: `Vacatures ${company}`,
    sections: [
      {
        children: [
          new Paragraph({ text: `Vacatures ${company}`, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [new TextRun({ text: 'Concept, opgesteld door een AI-agent. Laat nalezen door HR voor publicatie.', italics: true })],
          }),
          ...vacancies.flatMap((v) => [
            new Paragraph({ text: v.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
            new Paragraph({ children: [new TextRun({ text: `Afdeling: ${v.department}`, bold: true })] }),
            new Paragraph({ text: v.intro }),
            ...list('Wat ga je doen?', v.responsibilities),
            ...list('Wat vragen we?', v.requirements),
            ...list('Mooi meegenomen', v.niceToHave),
            ...list('Wat bieden we?', v.offer),
            ...(v.basedOn?.length
              ? [new Paragraph({ children: [new TextRun({ text: `Gebaseerd op marktvacatures: ${v.basedOn.join(', ')}`, size: 18, color: '666666' })] })]
              : []),
          ]),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Builds the .docx, stores it and returns its download id. */
export async function saveVacancyDocument(company: string, vacancies: VacancyDraft[]): Promise<string> {
  if (!vacancies?.length) throw new Error('Geef minstens één vacature.');
  const id = randomUUID();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${id}.docx`), await buildVacancyDocx(company, vacancies));
  return id;
}

export function readVacancyDocument(id: string): Buffer | undefined {
  if (!ID.test(id)) return undefined; // also blocks path traversal
  try {
    return readFileSync(join(DIR, `${id}.docx`));
  } catch {
    return undefined;
  }
}
