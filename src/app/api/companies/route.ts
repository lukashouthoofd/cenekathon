// The one company the dashboard shows; id matches the frontend demo fixtures so analyze/slack still match.
export function GET() {
  return Response.json({
    companies: [{ id: 'demo-bank', name: 'Goldman Stanley (gesimuleerd)', industry: 'Bankwezen', country: 'BE', synthetic: true }],
  });
}
