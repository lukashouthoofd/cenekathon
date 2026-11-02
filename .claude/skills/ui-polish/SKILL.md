---
name: ui-polish
description: Use when a UI works but looks generic or rough — fast visual design, layout, typography, states and accessibility fixes that make a demo look professional.
---

# UI polish (demo-grade in 30 minutes)

1. **Pick a direction in one line** (e.g. "calm, clinical, lots of whitespace" or "bold, dark, data-dense") and apply it everywhere. Avoid default-template look.
2. **Tokens, not magic numbers:** define colors, radius, spacing scale, font sizes once (Tailwind theme / CSS variables). One accent color + neutrals.
3. **Typography:** one font pair max; clear hierarchy (title ≥ 2× body); line length 50–75 chars; body ≥ 16 px.
4. **Layout:** consistent spacing (4/8 px scale), align to a grid, generous whitespace, one primary action per screen.
5. **States for everything:** loading (skeleton/spinner), empty (explain + CTA), error (human message + retry), success. Disabled while pending.
6. **Feedback:** hover/focus/active styles, subtle transitions (150–200 ms). `cursor: pointer` on clickable things.
7. **Accessibility basics:** contrast ≥ 4.5:1, visible focus ring, labels on inputs, `alt` text, semantic elements (`button`, not clickable `div`), keyboard reachable.
8. **Responsive:** check at 375 px and 1280 px; judges may look on a phone.
9. **Real content:** realistic data, no lorem ipsum, no "Test 123" in screenshots.
10. **Check it:** open the page, look at it. Take a screenshot at both sizes.

Upstream references: Vercel Web Interface Guidelines, Anthropic `frontend-design` skill (github.com/anthropics/skills) — vet before installing.
