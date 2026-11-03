#!/usr/bin/env bash
# Local demo in one command: SSH tunnel to the RAG API on the GPU VM + the Next.js agent (RAG tools) + the Vite frontend.
#   bash scripts/demo.sh   -> open http://localhost:5173   (needs .env with AI_API_KEY and AI_MODEL; Ctrl-C stops everything)
# The frontend's /api/chat goes to the Next agent on AGENT_PORT (default 3001; 3000 is often taken by Docker). Dashboard uses demo fixtures.
set -euo pipefail
cd "$(dirname "$0")/.."
AGENT_PORT=${AGENT_PORT:-3001}
[ -f .env ] && grep -q '^AI_API_KEY=.' .env || { echo "Missing AI_API_KEY in .env (copy .env.example to .env and fill it in)"; exit 1; }

PIDS=()
trap 'kill "${PIDS[@]}" 2>/dev/null' EXIT
if ! curl -sf localhost:8100/health >/dev/null; then
  ssh -o ExitOnForwardFailure=yes -N -L 8100:localhost:8000 team19 &
  PIDS+=($!)
  for i in $(seq 1 20); do curl -sf localhost:8100/health >/dev/null && break; sleep 1; done
fi
curl -sf localhost:8100/health >/dev/null && echo "RAG API reachable on :8100" || echo "WARNING: RAG API not reachable; the agent falls back to keyword search"

[ -d node_modules ] || npm install
[ -d src/frontend/node_modules ] || (cd src/frontend && npm install)
RAG_API_URL=http://localhost:8100 npx next dev -p "$AGENT_PORT" &
PIDS+=($!)
cd src/frontend
VITE_API_PROXY=http://localhost:$AGENT_PORT VITE_DEMO_MODE=true VITE_LIVE_CHAT=true npx vite
