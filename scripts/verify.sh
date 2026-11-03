#!/bin/sh
# Verification contract: run before every PR / "done". Extend with your stack's commands at kickoff
# (see docs/STACK.md). Fails loudly on the first problem.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

echo "== skills"; sh scripts/check-skills.sh

echo "== secrets"
if git grep -nIE '(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)' -- . ':!scripts/verify.sh' ; then
  echo "FAIL: possible secret committed"; exit 1
fi
if git ls-files --error-unmatch .env >/dev/null 2>&1; then echo "FAIL: .env is tracked"; exit 1; fi

# --- project checks: this repo's stack (frontend in src/frontend, Node backend in src/backend) ---
echo "== backend tests"; node --test src/backend/chat.test.mjs
echo "== frontend deps"; [ -d src/frontend/node_modules ] || npm ci --prefix src/frontend
echo "== frontend typecheck"; npm run --prefix src/frontend typecheck
echo "== frontend build"; npm run --prefix src/frontend build
echo "== backend syntax"; node --check src/backend/server.mjs; node --check src/backend/chat.mjs

echo "verify: OK"
