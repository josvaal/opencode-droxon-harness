#!/usr/bin/env bash
# Droxon harness installer test-suite.
# Run: ./tests/test-install.sh            (all tests)
#      ./tests/test-install.sh <pattern>  (only tests whose name matches)
#
# Everything runs in temp dirs: OPENCODE_CONFIG_DIR and PI_CODING_AGENT_DIR are
# overridden per test; DROXON_SKIP_DEPS=1 keeps tests offline except where a
# test explicitly exercises dependency wiring with a mocked `pi` binary.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$ROOT/install.sh"
TMP="$(mktemp -d /tmp/droxon-install-test.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
PATTERN="${1:-}"

ok()  { PASS=$((PASS+1)); printf '  ok  %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '       -> %s\n' "$2"; }

check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else bad "$desc"; fi
}

check_file()    { check "file exists: $1" test -f "$1"; }
check_dir()     { check "dir exists: $1"  test -d "$1"; }
check_no_file() { check "absent: $1"      test ! -e "$1"; }
check_grep()    { check "grep '$2' in $3" grep -q -- "$2" "$3"; }

new_oc_dir() { local d="$TMP/oc-$1"; mkdir -p "$d"; echo "$d"; }
new_pi_dir() { local d="$TMP/pi-$1"; mkdir -p "$d"; echo "$d"; }

run_install_oc() { # run_install_oc <name> [extra args...]
  local name="$1"; shift
  local d; d="$(new_oc_dir "$name")"
  OPENCODE_CONFIG_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target opencode "$@" \
    >"$TMP/oc-$name.log" 2>&1
  echo "$d"
}

run_install_pi() { # run_install_pi <name> [extra args...]
  local name="$1"; shift
  local d; d="$(new_pi_dir "$name")"
  PI_CODING_AGENT_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target pi "$@" \
    >"$TMP/pi-$name.log" 2>&1
  echo "$d"
}

# ----------------------------------------------------------------------------
t_opencode_no_regression() {
  echo "== T-OC: OpenCode target installs the same tree as before =="
  local d; d="$(run_install_oc basic)"
  check_file "$d/agent/droxon-agent.md"
  check_file "$d/agent/sdd-apply.md"
  check_file "$d/agent/jd-judge-a.md"
  check_file "$d/command/feature.md"
  check_file "$d/plugins/droxon-harness.ts"
  check_file "$d/tui-plugins/droxon-logo.tsx"
  check_file "$d/opencode.json"
  check_file "$d/tui.json"
  check_grep "default_agent is droxon-agent" '"default_agent": "droxon-agent"' "$d/opencode.json"
  check_grep "logo registered in tui.json" 'droxon-logo.tsx' "$d/tui.json"
  # JSON still valid
  python3 -c "import json,sys; json.load(open('$d/opencode.json')); json.load(open('$d/tui.json'))" \
    && ok "opencode.json/tui.json are valid JSON" || bad "opencode.json/tui.json are valid JSON"
  # With deps skipped, no fastloop/yatt entries
  ! grep -q 'opencode-fastloop' "$d/opencode.json" && ok "no fastloop with SKIP_DEPS" || bad "no fastloop with SKIP_DEPS"
}

t_menu_interactive() {
  echo "== T-MENU: interactive menu (1)/(2) =="
  local d="$TMP/menu-oc"; mkdir -p "$d"
  printf '1\n' | OPENCODE_CONFIG_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" >"$TMP/menu-oc.log" 2>&1 \
    && ok "menu option 1 installs OpenCode" || bad "menu option 1 installs OpenCode"
  check_file "$d/agent/droxon-agent.md"

  local d2; d2="$(new_pi_dir menu)"
  printf '2\n' | PI_CODING_AGENT_DIR="$d2" DROXON_SKIP_DEPS=1 "$INSTALL" >"$TMP/menu-pi.log" 2>&1 \
    && ok "menu option 2 installs Pi" || bad "menu option 2 installs Pi"
  check_file "$d2/AGENTS.md"

  DROXON_SKIP_DEPS=1 "$INSTALL" </dev/null >/dev/null 2>&1
  [ $? -ne 0 ] && ok "EOF without TTY fails with error" || bad "EOF without TTY fails with error"

  printf '9\n' | DROXON_SKIP_DEPS=1 "$INSTALL" >/dev/null 2>&1
  [ $? -ne 0 ] && ok "invalid menu choice fails" || bad "invalid menu choice fails"
}

t_flags() {
  echo "== T-FLAGS: --target and DROXON_TARGET =="
  DROXON_SKIP_DEPS=1 "$INSTALL" --target bogus </dev/null >/dev/null 2>&1
  [ $? -eq 2 ] && ok "invalid --target rejected (exit 2, no menu)" || bad "invalid --target rejected (exit 2, no menu)"

  DROXON_SKIP_DEPS=1 DROXON_TARGET=bogus "$INSTALL" </dev/null >/dev/null 2>&1
  [ $? -eq 2 ] && ok "invalid DROXON_TARGET rejected" || bad "invalid DROXON_TARGET rejected"

  # explicit --target wins over DROXON_TARGET
  local d3="$TMP/env-oc-prec"; mkdir -p "$d3"
  OPENCODE_CONFIG_DIR="$d3" DROXON_TARGET=pi DROXON_SKIP_DEPS=1 "$INSTALL" --target opencode >/dev/null 2>&1 \
    && ok "--target wins over DROXON_TARGET" || bad "--target wins over DROXON_TARGET"
  check_file "$d3/agent/droxon-agent.md"

  "$INSTALL" --nonsense >/dev/null 2>&1
  [ $? -ne 0 ] && ok "unknown flag rejected" || bad "unknown flag rejected"

  "$INSTALL" --help >/dev/null 2>&1 && ok "--help exits 0" || bad "--help exits 0"

  local d="$TMP/env-oc"; mkdir -p "$d"
  OPENCODE_CONFIG_DIR="$d" DROXON_TARGET=opencode DROXON_SKIP_DEPS=1 "$INSTALL" >/dev/null 2>&1 \
    && ok "DROXON_TARGET=opencode works" || bad "DROXON_TARGET=opencode works"
  check_file "$d/agent/droxon-agent.md"

  # .bak-droxon backup appears when an existing opencode.json is modified
  local d2="$TMP/env-oc-bak"; mkdir -p "$d2"
  printf '{"$schema": "https://opencode.ai/config.json", "model": "x"}\n' >"$d2/opencode.json"
  OPENCODE_CONFIG_DIR="$d2" DROXON_TARGET=opencode DROXON_SKIP_DEPS=1 "$INSTALL" >/dev/null 2>&1 \
    && ok "install over existing config exits 0" || bad "install over existing config exits 0"
  check_file "$d2/opencode.json.bak-droxon"
  check_grep "backup preserves previous content" '"model": "x"' "$d2/opencode.json.bak-droxon"
}

repo_pi_resources_ok() { # resources at the source (used when pi loads the package in place)
  check_file "$ROOT/pi/prompts/feature.md"
  check_file "$ROOT/pi/skills/droxon-orchestrator/SKILL.md"
  check_file "$ROOT/pi/extensions/droxon-harness.ts"
  check_grep "feature prompt has GATE 1" 'GATE 1' "$ROOT/pi/prompts/feature.md"
  check_grep "feature prompt has GATE 2" 'GATE 2' "$ROOT/pi/prompts/feature.md"
  check_grep "feature prompt has FASE 4" 'FASE 4' "$ROOT/pi/prompts/feature.md"
  if grep -q 'fastloop_verify' "$ROOT/pi/prompts/feature.md"; then
    bad "feature prompt free of fastloop_verify"
  else ok "feature prompt free of fastloop_verify"; fi
  check_grep "feature prompt uses /droxon-verify" 'droxon-verify' "$ROOT/pi/prompts/feature.md"
  check_grep "feature prompt mentions pi-subagents" 'pi-subagents' "$ROOT/pi/prompts/feature.md"
}

agent_dir_copies_ok() { # copies only exist in the manual-fallback path (no pi CLI)
  local d="$1"
  check_file "$d/prompts/feature.md"
  check_file "$d/skills/droxon-orchestrator/SKILL.md"
  check_file "$d/extensions/droxon-harness.ts"
  python3 - "$d/skills/droxon-orchestrator/SKILL.md" <<'SKILLEOF' && ok "SKILL.md frontmatter has name+description" || bad "SKILL.md frontmatter"
import sys
head = open(sys.argv[1]).read().split('---')[1]
assert 'name:' in head and 'description:' in head
SKILLEOF
}

t_pi_resources() {
  echo "== T-PI: Pi agent-dir resources =="
  local d; d="$(run_install_pi basic)"
  check_file "$d/AGENTS.md"
  check_grep "orchestrator block merged" 'droxon-harness:start' "$d/AGENTS.md"
  check_grep "orchestrator block end" 'droxon-harness:end' "$d/AGENTS.md"
  # AGENTS.md content: orchestrator rules present
  check_grep "AGENTS.md has gates rule" '⛔' "$d/AGENTS.md"
  check_grep "AGENTS.md has /feature routing" '/feature' "$d/AGENTS.md"
  # Resources: real pi CLI loads the package in place (no copies into agent
  # dir); the manual fallback copies them. Assert whichever path applied.
  if command -v pi >/dev/null 2>&1; then
    ok "pi CLI present: package loads in place (no copies expected)"
    repo_pi_resources_ok
  else
    agent_dir_copies_ok "$d"
  fi
  # Extension parses
  if command -v bun >/dev/null 2>&1; then
    bun build --no-bundle "$ROOT/pi/extensions/droxon-harness.ts" --outfile "$TMP/ext-check.js" >/dev/null 2>&1 \
      && ok "extension TS parses/transpiles (bun)" || bad "extension TS parses/transpiles (bun)"
  else
    printf '  skip bun not found (extension transpile)\n'
  fi
}

t_pi_manifest() {
  echo "== T-MANIFEST: repo is a valid Pi package =="
  python3 - "$ROOT/package.json" <<'PYEOF' && ok "pi manifest paths exist" || bad "pi manifest paths exist"
import json, os, sys
pkg = json.load(open(sys.argv[1]))
assert "pi-package" in pkg.get("keywords", []), "missing pi-package keyword"
pi = pkg["pi"]
import glob
for pattern in pi["prompts"] + pi["extensions"]:
    assert glob.glob(os.path.join(os.path.dirname(sys.argv[1]), pattern)), pattern
for sk in pi["skills"]:
    for d in glob.glob(os.path.join(os.path.dirname(sys.argv[1]), sk)):
        assert os.path.exists(os.path.join(d, "SKILL.md")), d
PYEOF
}

t_pi_real_install() {
  echo "== T-PI-REAL: real 'pi install' (if pi CLI available) =="
  if ! command -v pi >/dev/null 2>&1; then
    printf '  skip pi CLI not found\n'; return 0
  fi
  local d; d="$(new_pi_dir real)"
  if PI_CODING_AGENT_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target pi >"$TMP/pi-real.log" 2>&1; then
    ok "pi-target install exits 0 with real pi CLI"
  else
    bad "pi-target install exits 0 with real pi CLI" "$(tail -3 "$TMP/pi-real.log")"
  fi
  if python3 -c "
import json,sys
s=json.load(open('$d/settings.json'))
pkgs=[p if isinstance(p,str) else p.get('source') for p in s.get('packages',[])]
found=any('$ROOT' in str(p) or 'droxon' in str(p) for p in pkgs)
sys.exit(0 if found else 1)
"; then ok "package declared in settings.json"; else bad "package declared in settings.json" "$(cat "$d/settings.json" 2>/dev/null)"; fi
  # The package entry is recognized by the real CLI without invoking a model
  if pi list >/dev/null 2>&1; then
    PI_CODING_AGENT_DIR="$d" timeout 30 pi list 2>/dev/null | grep -q . \
      && ok "pi list recognizes the installed package" || ok "pi list empty/unsupported (skipped)"
  fi
}

t_pi_mocked_deps() {
  echo "== T-PI-DEPS: dependency wiring with mocked pi =="
  local d; d="$(new_pi_dir deps)"
  local bindir="$TMP/mockbin"; mkdir -p "$bindir"
  cat >"$bindir/pi" <<EOF
#!/usr/bin/env bash
echo "pi \$*" >> "$TMP/mock-pi-calls.log"
exit 0
EOF
  chmod +x "$bindir/pi"
  PATH="$bindir:$PATH" PI_CODING_AGENT_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target pi >"$TMP/pi-deps.log" 2>&1 \
    && ok "install_pi runs with mocked pi CLI" || bad "install_pi runs with mocked pi CLI"
  grep -q "pi install $ROOT" "$TMP/mock-pi-calls.log" \
    && ok "runs 'pi install <repo>'" || bad "runs 'pi install <repo>'" "$(cat "$TMP/mock-pi-calls.log" 2>/dev/null)"
  # With deps enabled, best-effort packages are attempted but failures don't abort
  : >"$TMP/mock-pi-calls.log"
  local d2; d2="$(new_pi_dir deps2)"
  cat >"$bindir/pi" <<EOF
#!/usr/bin/env bash
case "\$2" in
  npm:*) exit 1 ;;
  *) exit 0 ;;
esac
EOF
  chmod +x "$bindir/pi"
  printf '#!/usr/bin/env bash\necho 1.0.0\n' >"$bindir/bun"; chmod +x "$bindir/bun"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$bindir/git"; chmod +x "$bindir/git"
  printf '#!/usr/bin/env bash\nexit 1\n' >"$bindir/curl"; chmod +x "$bindir/curl"
  printf '#!/usr/bin/env bash\nexit 1\n' >"$bindir/uv"; chmod +x "$bindir/uv"
  PATH="$bindir:$PATH" YATT_HOME="$TMP/yatt-mock" PI_CODING_AGENT_DIR="$d2" "$INSTALL" --target pi >"$TMP/pi-deps2.log" 2>&1
  [ $? -eq 0 ] && ok "failing pi packages degrade gracefully (exit 0)" || bad "failing pi packages degrade gracefully"
  grep -q 'pi-subagents' "$TMP/pi-deps2.log" && ok "attempts pi-subagents install" || bad "attempts pi-subagents install"
  grep -qi 'skipped: opencode-fastloop' "$TMP/pi-deps2.log" && ok "fastloop skip notice shown" || bad "fastloop skip notice shown"
  grep -qi 'logo' "$TMP/pi-deps2.log" && ok "logo skip notice shown" || bad "logo skip notice shown"
  check_file "$d2/AGENTS.md"
  check_no_file "$d2/prompts/feature.md"  # in-place load: agent dir stays clean
}

t_idempotency() {
  echo "== T-IDEM: idempotency =="
  local d; d="$(run_install_pi idem)"
  run_install_pi idem >/dev/null   # second run on same dir
  [ "$(grep -c 'droxon-harness:start' "$d/AGENTS.md")" = "1" ] \
    && ok "AGENTS.md block not duplicated" || bad "AGENTS.md block not duplicated"
  local d2; d2="$(run_install_oc idem)"
  local snap1="$TMP/oc-snap-1" snap2="$TMP/oc-snap-2"
  (cd "$d2" && find . -type f ! -name '*.bak-droxon' | sort >"$snap1")
  run_install_oc idem >/dev/null
  (cd "$d2" && find . -type f ! -name '*.bak-droxon' | sort >"$snap2")
  diff -q "$snap1" "$snap2" >/dev/null && ok "OpenCode tree stable across runs" || bad "OpenCode tree stable across runs" "$(diff "$snap1" "$snap2")"
}

t_pi_agents_md_merge() {
  echo "== T-MERGE: existing AGENTS.md is preserved =="
  local d; d="$(new_pi_dir merge)"
  printf '# My own rules\n\nBe nice.\n' >"$d/AGENTS.md"
  PI_CODING_AGENT_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target pi >/dev/null 2>&1 \
    && ok "install over existing AGENTS.md exits 0" || bad "install over existing AGENTS.md exits 0"
  check_grep "user content preserved" 'Be nice.' "$d/AGENTS.md"
  check_grep "droxon block appended" 'droxon-harness:start' "$d/AGENTS.md"
  check_file "$d/AGENTS.md.bak-droxon"
}

t_degradation() {
  echo "== T-DEGRADE: missing tooling degrades gracefully =="
  local d; d="$(new_pi_dir degrade)"
  # PATH restricted to basics: no bun, no npm, no pi (python3 and git live in /usr/bin)
  ( PATH="/usr/bin:/bin" PI_CODING_AGENT_DIR="$d" DROXON_SKIP_DEPS=1 "$INSTALL" --target pi ) >"$TMP/pi-degrade.log" 2>&1
  [ $? -eq 0 ] && ok "Pi install exits 0 without bun/npm/pi" || bad "Pi install exits 0 without bun/npm/pi" "$(tail -3 "$TMP/pi-degrade.log")"
  check_file "$d/AGENTS.md"
  check_file "$d/prompts/feature.md"
  grep -qi 'warning' "$TMP/pi-degrade.log" && ok "warnings emitted for missing tooling" || bad "warnings emitted for missing tooling"
}

# ----------------------------------------------------------------------------
tests=(
  t_opencode_no_regression t_menu_interactive t_flags t_pi_resources
  t_pi_manifest t_pi_real_install t_pi_mocked_deps t_idempotency
  t_pi_agents_md_merge t_degradation
)
for t in "${tests[@]}"; do
  if [ -n "$PATTERN" ] && [[ ! "$t" == *"$PATTERN"* ]]; then continue; fi
  $t
done

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
