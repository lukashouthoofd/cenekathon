---
name: ai-in-the-product
description: Use when the product itself calls an LLM or ML model — structured output, prompts, tokens and secrets, quick evals, cost/latency, fallbacks, and the "ML in practice → scalable" story.
---

# AI inside the product

- **Keys:** from `.env` (`.env.example` lists the names). Server-side only; never ship a key to the browser or commit it. Organisers provide AI tokens — use the provider/base URL they give.
- **One thin wrapper** (`src/lib/llm.*`) so provider/model swaps are a one-line change. Set timeouts and a cached fallback response for the demo.
- **Structured output:** ask for JSON matching a schema (Zod/Pydantic), validate, retry once on parse failure. Don't regex free text.
- **Prompts in files** (`prompts/*.md`), with 3–5 example inputs/outputs beside them.
- **Test on 5 real examples** before building UI around it; keep them as `fixtures/` — they double as demo data and as your "evaluation" slide.
- **Ground it:** feed the model the actual data; show inputs/sources next to answers. Give it an explicit "I don't know" path.
- **Cost/latency:** cheapest model that passes your 5 examples; cache by input hash; stream long outputs.
- **Classic ML:** baseline (rules/regression) first; report one honest metric. A pre-trained API or model beats training in 4 hours.
- **Pitch hooks:** what the model does, what happens when it's wrong, how it scales (batching, caching, queue, eval set), data privacy.
- No real personal data in prompts; treat model output as untrusted (escape before rendering).

**Done when:** the AI path works on the 5 fixtures, fails gracefully, and no secret is in git.
