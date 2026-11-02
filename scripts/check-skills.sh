#!/bin/sh
# Validate every .agents/skills/<name>/SKILL.md: frontmatter, name == folder, description present,
# and that .claude/skills mirror is in sync.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fail=0
for dir in "$root"/.agents/skills/*/; do
  name=$(basename "$dir")
  f="$dir/SKILL.md"
  if [ ! -f "$f" ]; then echo "FAIL $name: missing SKILL.md"; fail=1; continue; fi
  [ "$(head -n1 "$f")" = "---" ] || { echo "FAIL $name: no frontmatter"; fail=1; }
  fm=$(sed -n '2,/^---$/p' "$f")
  echo "$fm" | grep -q "^name: $name\$" || { echo "FAIL $name: 'name:' must equal folder name"; fail=1; }
  # description may be inline or a YAML block/continuation on the next line
  echo "$fm" | grep -qE "^description:( .|$)" && { echo "$fm" | grep -qE "^description: ." || echo "$fm" | grep -A1 "^description:" | tail -n1 | grep -q "^[[:space:]]\+[^[:space:]]"; } || { echo "FAIL $name: missing description"; fail=1; }
  if [ -f "$root/.claude/skills/$name/SKILL.md" ]; then
    cmp -s "$f" "$root/.claude/skills/$name/SKILL.md" || { echo "FAIL $name: .claude mirror stale (run scripts/sync-skills.sh)"; fail=1; }
  else
    echo "FAIL $name: not mirrored (run scripts/sync-skills.sh)"; fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "check-skills: OK ($(ls -d "$root"/.agents/skills/*/ | wc -l | tr -d ' ') skills)"
exit "$fail"
