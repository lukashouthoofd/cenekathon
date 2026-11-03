# Likely judge questions, and our answers

> Prepared for the 19:00 pitch. Every answer uses only facts from this repo and the deck.
> Numbers come from `docs/pitch/index.html`, `docs/FUTURE_TECHWOLF_MODELS.md` (measured
> figures only) and `docs/PITCH.md`. If a number changes, change it here too.

## Data

**1. Is the vacancy data real?**
Yes. We use the licensed finance vacancy files: 1.34M deduplicated vacancies from BE, NL, LU and
UK, Jan 2021 to Sep 2026 (1.54M raw rows). The licence is for team use only, so the data stays in
`data/` (git-ignored) and is never pushed. Internal bank data is synthetic and labelled as such.

**2. How many vacancies did you actually analyse, and how many were duplicates?**
Measured: 1,542,169 raw vacancies, 2021–2026, 0 duplicate IDs, 145,608 content duplicates flagged.
The deck's headline uses 1.34M after deduplication. Say which one you mean if asked.

**3. How did you deduplicate?**
Same title, company, date posted and country count as one posting. Duplicates are removed before any count.

**4. Are the postings representative of the whole labour market?**
No. Most postings are English (about three quarters UK). Collection was incomplete from January to
April 2026. We say this on the slide that uses the data, and we do not extrapolate beyond the sample.

**5. Where does the data come from, and can a bank use it?**
Vacancy data: a licensed dataset, team use only. A bank using it commercially would need its own
licence. Public reference data (ESCO, GLEIF, Eurostat, ONS, CBS, Statbel) is open. The product
design does not depend on the vacancy licence; it depends on a licence for the pilot data.

## Method and accuracy

**6. Are the skill figures verified skills?**
No. They are keyword counts (a regex on title and description). The chat prompt tells the model to
say so, and the data notes say the same.

**7. Why not use an LLM for everything?**
The counts, trends and benchmarks are exact SQL on DuckDB: free, repeatable and explainable.
Claude only sees about 20 summary numbers per company, never the million rows. That keeps cost low
and keeps the reasoning checkable.

**8. How accurate is the skill tagger?**
Not measured yet. The test plan is on slide 13 ("[x]% vs [y]%", walled-off test set). Until that
run is done, do not quote an accuracy number. The honest answer is: the figures are keyword counts,
and the precision check is the next step.

**9. How reliable are the company AI scores?**
They are model inferences from public postings only. We never claim a company's real AI spend,
AI usage or headcount. We keep the raw probabilities for audit.

**10. Why does ESCO matter?**
ESCO is the EU skills and occupations standard. Using it means a bank's internal job architecture
can be compared with the market one-to-one. This is also why we chose TechWolf's approach for the
next step.

## Privacy and risk

**11. Is it privacy-safe?**
No named individuals. We only use team-level aggregates. The demo uses synthetic internal data,
and every row is marked synthetic. Job postings are treated as untrusted input, and no model
output acts without a human click.

**12. Can the AI give wrong advice?**
Yes, and we design for it. HR signs off every vacancy and engineers sign off every tool build.
Advice cites the numbers it uses. Claude has hard token caps per request.

## Scope and next steps

**13. What is real in the demo, and what is mocked?**
Real: the chat answers from the vacancy summary numbers via the Anthropic API, and refusal of
off-topic questions. Mocked or partial: the simulated bank (Goldman Stanley in the deck), the
readiness dashboard (fixtures in demo mode), Slack (preview only, no message is sent), and HR
profiles (a document, not a live system).

**14. Why not use TechWolf's models now?**
Not built. We started the title and skill mapping with JobBERT-v3 and ConTeXT, but stopped for
time. ConTeXT has no published licence, so we need TechWolf's confirmation before any product use.
See slide 13b.

**15. What happens after the hackathon?**
A pilot with one company's real internal skills data (slide 13, "Next"). Then job board publishing,
and more channels later.

**16. How would this scale to 100 companies?**
Bulk work runs on local models (encoders and Gemma 4 on our GPU), so the cost per company is
small and does not grow with tokens. The main limits are the licence and the data pipeline, not
the model. See slide 11 ("What breaks at 100×").

## Open items before the pitch (team)

- Confirm the skill-tagger accuracy run, or drop the number from slide 13.
- Decide 1.34M (deduplicated) or 1.54M (raw) as the headline, and use it on every slide.
- The simulated bank is named Goldman Stanley everywhere in the deck. Check the app's mock data
  (`src/backend/mock/internal-bank.json`) before the demo, so the UI shows the same name.
- Fill the TODO slides (cost, TAM/SAM/SOM, competitors, team contact) or remove them before the pitch.
