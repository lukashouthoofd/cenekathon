import { data } from '@/lib/data';

// Side panel next to the chat: the same company data the agent reasons over.
export async function GET() {
  const gaps = data.market_trends
    .map((t) => ({
      skill: t.skill,
      growthPct: t.growth_pct_yoy,
      internalPeople: data.internal_skills.filter((s) => s.skill === t.skill).reduce((n, s) => n + s.people, 0),
      ref: t.id,
    }))
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 4);
  const scores = Object.entries(data.scores).map(([dimension, s]) => ({ dimension, ...s }));
  return Response.json({ company: data.company, scores, gaps, synthetic: true });
}
