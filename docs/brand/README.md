# Json icon

Square mark for the assistant "Json": a white J on a rounded accent-teal tile.
Colours: accent `#208989` (tile), white `#FFFFFF` (mark), from the tokens in `src/frontend/src/index.css`.
Used in the app header (`src/frontend/src/App.tsx`), as the browser favicon (`src/frontend/index.html`, `src/frontend/public/json-icon.svg`), and as the Slack app icon (`json-icon-512.png`).
To regenerate: edit `src/frontend/public/json-icon.svg`, then export a 512x512 PNG to `docs/brand/json-icon-512.png` with any SVG renderer (e.g. `rsvg-convert -w 512 -h 512 json-icon.svg -o json-icon-512.png`).
