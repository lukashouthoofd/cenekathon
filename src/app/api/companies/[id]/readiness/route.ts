// Readiness for the synthetic bank, computed by the RAG API from the real vacancy data.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await fetch(`${process.env.RAG_API_URL ?? 'http://localhost:8100'}/readiness`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json({ ...(await res.json()), companyId: id });
  } catch {
    return Response.json({ error: 'RAG-API niet bereikbaar' }, { status: 503 });
  }
}
