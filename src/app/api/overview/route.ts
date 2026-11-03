import { data } from '@/lib/data';

const usedBy = (sw: { used_by: string }, department: string) =>
  sw.used_by === 'alle afdelingen' || sw.used_by.includes(department);

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

  // Per tool: its AI status and the repetitive work of the departments that use it.
  const software = data.software.map((sw) => ({
    name: sw.name,
    usedBy: sw.used_by,
    aiFeatures: sw.ai_features,
    repetitiveHoursPerWeek: data.tasks
      .filter((t) => t.repetitive && usedBy(sw, t.department))
      .reduce((n, t) => n + t.hours_per_week, 0),
    ref: sw.id,
  }));

  const scores = Object.entries(data.scores).map(([dimension, s]) => ({ dimension, ...s }));

  // Readable label per source reference, so citations like [is3] can be explained in the chat.
  const refs: Record<string, string> = Object.fromEntries([
    ...data.market_trends.map((r) => [r.id, `Marktvraag: ${r.skill} (+${r.growth_pct_yoy}% per jaar, ${r.postings} vacatures)`]),
    ...data.internal_skills.map((r) => [r.id, `Interne skill: ${r.department} · ${r.skill} · ${r.people} mensen, niveau ${r.level}`]),
    ...data.software.map((r) => [r.id, `Software: ${r.name} (${r.ai_features}), gebruikt door ${r.used_by}`]),
    ...data.training.map((r) => [r.id, `Opleiding: ${r.title} · ${r.department} · ${r.participants} deelnemers (${r.year})`]),
    ...data.tasks.map((r) => [r.id, `Taak: ${r.department} · ${r.task} · ${r.hours_per_week} uur per week`]),
  ]);

  return Response.json({ company: data.company, scores, gaps, software, refs, synthetic: true });
}
