#!/bin/sh
# Mirror .agents/skills/<name> into .claude/skills/<name> so Claude Code loads the catalog.
# Always copies (symlinks are unreliable on Windows). Idempotent. Run after adding/editing a skill.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
src="$root/.agents/skills"
dest="$root/.claude/skills"
[ -d "$src" ] || { echo "sync-skills: no .agents/skills directory"; exit 0; }
rm -rf "$dest"
mkdir -p "$dest"
n=0
for dir in "$src"/*/; do
  [ -f "$dir/SKILL.md" ] || continue
  cp -R "$dir" "$dest/$(basename "$dir")"
  n=$((n + 1))
done
echo "sync-skills: $n skills mirrored to .claude/skills"
