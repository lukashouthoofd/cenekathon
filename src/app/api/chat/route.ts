import { answer, type ChatMessage } from '@/lib/agent';

// Response shape matches ChatResponse in src/frontend/src/types.ts.
export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  try {
    const { content, proposed, suggestions } = await answer(messages);
    return Response.json({ message: { role: 'assistant', content, proposed, suggestions }, mode: 'live' });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
