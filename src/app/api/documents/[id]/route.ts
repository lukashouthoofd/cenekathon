import { readVacancyDocument } from '@/lib/vacancyDoc';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const file = readVacancyDocument((await params).id);
  if (!file) return new Response('Document niet gevonden', { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="vacatures.docx"',
    },
  });
}
