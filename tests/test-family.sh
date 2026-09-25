#!/usr/bin/env bash
# Droxon model-family test-suite (Qwen/GLM detection + injection wiring).
# Run: bash tests/test-family.sh
#
# Two layers: behavioral specs via bun (skipped cleanly when bun is missing,
# same as the extension-transpile check in test-install.sh), then
# source-level assertions that the injection wiring and installer changes
# exist where the docs say they do.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PASS=0
FAIL=0

ok()  { PASS=$((PASS+1)); printf '  ok  %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '       -> %s\n' "$2"; }

check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else bad "$desc"; fi
}

check_file() { check "file exists: $1" test -f "$1"; }
check_grep() { check "grep '$2' in $3" grep -q -- "$2" "$3"; }

# ----------------------------------------------------------------------------
t_family_spec() {
  echo "== T-FAMILY-SPEC: bun test tests/family.spec.ts =="
  if command -v bun >/dev/null 2>&1; then
    (cd "$ROOT" && bun test tests/family.spec.ts) >/dev/null 2>&1 \
      && ok "family spec passes (bun)" || bad "family spec passes (bun)"
  else
    printf '  skip bun not found (family spec)\n'
  fi
}

t_family_sources() {
  echo "== T-FAMILY-SOURCES: injection wiring + packaging =="
  check_grep "plugin detects per message (chat.message)" 'chat.message' "$ROOT/plugin/droxon-harness.ts"
  check_grep "plugin injects via system transform" 'experimental.chat.system.transform' "$ROOT/plugin/droxon-harness.ts"
  check_grep "pi extension hooks before_agent_start" 'before_agent_start' "$ROOT/pi/extensions/droxon-harness.ts"
  check_grep "plugin imports the shared family module" 'model-family.ts' "$ROOT/plugin/droxon-harness.ts"
  check_grep "pi extension imports the shared family module" 'model-family.ts' "$ROOT/pi/extensions/droxon-harness.ts"
  check_file "$ROOT/docs/qwen-notes.md"
  check_grep "package.json keyword qwen" '"qwen"' "$ROOT/package.json"
  check_grep "installer copies model-family.ts" 'model-family.ts' "$ROOT/install.sh"
}

# ----------------------------------------------------------------------------
tests=(t_family_spec t_family_sources)
for t in "${tests[@]}"; do
  $t
done

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
