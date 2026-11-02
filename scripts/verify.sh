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

# --- project checks: auto-detected; replace with explicit commands once the stack is chosen ---
if [ -f package.json ]; then
  echo "== node"
  [ -d node_modules ] || npm install
  npm run --if-present build
  npm run --if-present test
fi
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  echo "== python"
  if command -v pytest >/dev/null 2>&1; then pytest -q || [ $? -eq 5 ]; fi
fi

echo "verify: OK"
