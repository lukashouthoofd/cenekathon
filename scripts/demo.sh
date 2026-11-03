#!/usr/bin/env bash
# Local demo in one command: SSH tunnel to the RAG API on the GPU VM + the Next.js app on http://localhost:3000.
#   bash scripts/demo.sh   (PORT=3001 if 3000 is taken; needs .env with AI_API_KEY and AI_MODEL; Ctrl-C stops the app and the tunnel)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && grep -q '^AI_API_KEY=.' .env || { echo "Missing AI_API_KEY in .env (copy .env.example to .env and fill it in)"; exit 1; }

if ! curl -sf localhost:8100/health >/dev/null; then
  ssh -o ExitOnForwardFailure=yes -N -L 8100:localhost:8000 team19 &
  TUNNEL=$!
  trap 'kill $TUNNEL 2>/dev/null' EXIT
  for i in $(seq 1 20); do curl -sf localhost:8100/health >/dev/null && break; sleep 1; done
fi
curl -sf localhost:8100/health && echo "  <- RAG API reachable on :8100" || echo "WARNING: RAG API not reachable; the agent falls back to keyword search"

[ -d node_modules ] || npm install
RAG_API_URL=http://localhost:8100 npx next dev -p "${PORT:-3000}"
