#!/usr/bin/env bash
# opencode-droxon-harness — install-and-play installer.
#
# Targets (interactive menu, --target flag, or DROXON_TARGET env):
#   (1) OpenCode — installs into OpenCode's global config (~/.config/opencode,
#       override with OPENCODE_CONFIG_DIR):
#         agent/*.md                Droxon-Agent + sdd-* + jd-judges
#         command/feature.md        /feature command
#         plugins/droxon-harness.ts task-prompt contract hook
#         tui-plugins/droxon-logo.tsx + tui.json registration
#       And sets up the dependencies:
#         - opencode-fastloop (npm plugin; completion gate)
#         - YATT MCP server   (github.com/josvaal/yatt; E2E browser verification)
#         - spec-kit / specify CLI (github.com/github/spec-kit; optional)
#       Finally: default_agent = droxon-agent, gentle-orchestrator removed.
#
#   (2) Pi Agent — installs the harness as a Pi package (pi.dev/packages) into
#       the Pi agent dir (~/.pi/agent, override with PI_CODING_AGENT_DIR):
#         pi install <this repo>      prompts (/feature) + skills + extension
#         pi install npm:pi-subagents subagent delegation for Pi
#         AGENTS.md                   droxon orchestrator block (merged, backup)
#         YATT + spec-kit             shared deps (same as OpenCode)
#         pi-mcp-adapter              suggested, to expose YATT as MCP (best effort)
#       Not portable to Pi (skipped with a notice): opencode-fastloop, TUI logo.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
YATT_HOME="${YATT_HOME:-$HOME/.local/share/yatt}"
SKIP_DEPS="${DROXON_SKIP_DEPS:-0}"

log()  { printf '  %s\n' "$*"; }
warn() { printf '  WARNING: %s\n' "$*"; }

usage() {
  cat <<EOF
Usage: ./install.sh [--target opencode|pi]

Installs the Droxon harness for the selected coding agent.
  --target opencode   Install into OpenCode (~/.config/opencode, override with
                      OPENCODE_CONFIG_DIR). Same as menu option (1).
  --target pi         Install into Pi Agent (~/.pi/agent, override with
                      PI_CODING_AGENT_DIR). Same as menu option (2).
  -h, --help          Show this help.

Environment: DROXON_TARGET=opencode|pi (same as --target), DROXON_SKIP_DEPS=1,
OPENCODE_CONFIG_DIR, PI_CODING_AGENT_DIR, YATT_HOME.
EOF
}

select_target() {
  case "${TARGET:-}" in
    opencode|pi) return 0 ;;
  esac
  echo "==> Which coding agent do you want to install the Droxon harness into?"
  echo "  (1) OpenCode"
  echo "  (2) Pi Agent"
  printf "Choice [1-2]: "
  local choice
  if ! read -r choice; then
    echo "" >&2
    echo "ERROR: no target specified (stdin closed). Use --target opencode|pi (or DROXON_TARGET)." >&2
    exit 2
  fi
  case "$choice" in
    1) TARGET="opencode" ;;
    2) TARGET="pi" ;;
    *) echo "ERROR: invalid choice: '$choice' (expected 1 or 2)." >&2; exit 2 ;;
  esac
}

# ----------------------------------------------------------------------------
# Shared dependencies
# ----------------------------------------------------------------------------
ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    log "bun found: $(bun --version)"
    return 0
  fi
  echo "Installing bun (required by YATT MCP)..."
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || {
    warn "could not install bun automatically; install it from https://bun.sh and re-run"
    return 1
  }
  export PATH="$HOME/.bun/bin:$PATH"
  command -v bun >/dev/null 2>&1 || { warn "bun not on PATH after install"; return 1; }
  log "bun installed: $(bun --version)"
}

ensure_yatt_repo() {
  ensure_bun || { warn "skipping YATT setup (no bun)"; return 0; }
  if [ -d "$YATT_HOME/.git" ]; then
    log "YATT repo found at $YATT_HOME — pulling latest..."
    git -C "$YATT_HOME" pull --ff-only >/dev/null 2>&1 || warn "git pull failed (continuing with current copy)"
  else
    echo "Cloning YATT (github.com/josvaal/yatt)..."
    git clone --depth 1 https://github.com/josvaal/yatt.git "$YATT_HOME" || {
      warn "could not clone YATT; E2E verification will be unavailable (the harness degrades gracefully)"; return 0; }
  fi
  log "installing YATT MCP dependencies (bun install)..."
  (cd "$YATT_HOME/mcp" && bun install >/dev/null 2>&1) || warn "bun install failed in yatt/mcp"
}

ensure_speckit() {
  if command -v specify >/dev/null 2>&1; then
    log "specify CLI found: $(command -v specify)"
    return 0
  fi
  if ! command -v uv >/dev/null 2>&1; then
    echo "Installing uv (required by spec-kit)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || {
      warn "could not install uv; spec-kit scaffolding unavailable (optional — /feature works without it)"; return 0; }
    export PATH="$HOME/.local/bin:$PATH"
  fi
  echo "Installing spec-kit (specify CLI)..."
  uv tool install --force specify-cli --from "git+https://github.com/github/spec-kit.git" >/dev/null 2>&1 \
    && log "specify installed: $(command -v specify || echo ~/.local/bin/specify)" \
    || warn "spec-kit install failed (optional — /feature works without it)"
}

# ----------------------------------------------------------------------------
# Target: OpenCode
# ----------------------------------------------------------------------------
ensure_fastloop() {
  local DEST="$1"
  python3 - "$DEST/opencode.json" "$DEST/tui.json" <<'PYEOF'
import json, os, sys
op, tp = sys.argv[1], sys.argv[2]

def load(p, default):
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return default

def save(p, d):
    with open(p, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)

oc = load(op, {"$schema": "https://opencode.ai/config.json"})
plugins = oc.setdefault("plugin", [])
changed = False
if "opencode-fastloop/server" not in plugins:
    plugins.append("opencode-fastloop/server")
    changed = True
    print("  opencode.json plugin += opencode-fastloop/server")
save(op, oc)

tc = load(tp, {"$schema": "https://opencode.ai/tui.json"})
tplugins = tc.setdefault("plugin", [])
if "opencode-fastloop" not in tplugins:
    tplugins.append("opencode-fastloop")
    changed = True
    print("  tui.json plugin += opencode-fastloop")
save(tp, tc)
if not changed:
    print("  fastloop already registered")
PYEOF
}

register_yatt_opencode() {
  local DEST="$1"
  python3 - "$DEST/opencode.json" "$YATT_HOME" <<'PYEOF'
import json, os, sys
op, yatt = sys.argv[1], sys.argv[2]
oc = {}
if os.path.exists(op):
    with open(op) as f:
        oc = json.load(f)
mcp = oc.setdefault("mcp", {})
want = {"enabled": True, "type": "local",
        "command": ["bun", "run", os.path.join(yatt, "mcp", "src", "server.ts"), "--root", yatt]}
if mcp.get("yatt") != want:
    mcp["yatt"] = want
    with open(op, "w") as f:
        json.dump(oc, f, indent=2, ensure_ascii=False)
    print(f"  opencode.json mcp.yatt -> local server at {yatt}")
else:
    print("  YATT MCP already registered")
PYEOF
}

install_harness_opencode() {
  local DEST="$1"
  for dir in agent command plugins tui-plugins; do
    mkdir -p "$DEST/$dir"
  done

  for f in "$SRC"/agent/*.md; do
    cp "$f" "$DEST/agent/$(basename "$f")"
  done
  cp "$SRC/command/feature.md"       "$DEST/command/feature.md"
  cp "$SRC/plugin/droxon-harness.ts" "$DEST/plugins/droxon-harness.ts"
  cp "$SRC/tui/droxon-logo.tsx"      "$DEST/tui-plugins/droxon-logo.tsx"
  if [ -f "$DEST/tui-plugins/gentle-logo.tsx" ]; then
    rm "$DEST/tui-plugins/gentle-logo.tsx"
    log "removed tui-plugins/gentle-logo.tsx (logo replaced)"
  fi

  python3 - "$DEST/tui.json" <<'PYEOF'
import json, os, sys
path = sys.argv[1]
entry = os.path.join(os.path.dirname(path), "tui-plugins", "droxon-logo.tsx")
data = {"$schema": "https://opencode.ai/tui.json", "plugin": []}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
plugins = data.setdefault("plugin", [])
data["plugin"] = [p for p in plugins if "gentle-logo" not in str(p)]
if entry not in data["plugin"]:
    data["plugin"].append(entry)
    print(f"  tui.json plugin += {entry}")
with open(path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PYEOF

  # default_agent -> droxon-agent; remove gentle-orchestrator (full replacement)
  python3 - "$DEST/opencode.json" <<'PYEOF'
import json, shutil, sys, os
path = sys.argv[1]
data = {}
if os.path.exists(path):
    bak = path + ".bak-droxon"
    if not os.path.exists(bak):
        shutil.copy2(path, bak)  # keep the pristine pre-droxon backup; never overwrite it
        print(f"  (backup: {bak})")
    with open(path) as f:
        data = json.load(f)
changed = False
if data.get("default_agent") != "droxon-agent":
    data["default_agent"] = "droxon-agent"
    changed = True
    print("  default_agent -> droxon-agent")
if "gentle-orchestrator" in data.get("agent", {}):
    del data["agent"]["gentle-orchestrator"]
    changed = True
    print("  removed agent: gentle-orchestrator (full replacement)")
if changed:
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
else:
    print("  agent config already up to date")
PYEOF
}

install_opencode() {
  local DEST="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
  echo "==> Droxon harness [OpenCode -> $DEST]: installing harness files..."
  install_harness_opencode "$DEST"

  if [ "$SKIP_DEPS" != "1" ]; then
    echo "==> Dependencies: opencode-fastloop (completion gate)..."
    ensure_fastloop "$DEST"
    echo "==> Dependencies: YATT (E2E browser verification)..."
    ensure_yatt_repo
    register_yatt_opencode "$DEST"
    echo "==> Dependencies: spec-kit (optional spec scaffolding)..."
    ensure_speckit
  else
    echo "==> Skipping dependencies (DROXON_SKIP_DEPS=1)"
  fi

  echo "==> Done. Installed (OpenCode):"
  log "agent/: droxon-agent.md + sdd-{init,explore,propose,research,spec,design,tasks,apply,verify,archive,onboard}.md + jd-judge-{a,b}.md"
  log "command/feature.md"
  log "plugins/droxon-harness.ts"
  log "tui-plugins/droxon-logo.tsx (registered in tui.json)"
  [ "$SKIP_DEPS" != "1" ] && log "deps: opencode-fastloop + YATT ($YATT_HOME) + spec-kit (best effort)"

  echo
  echo "Restart OpenCode. Notes:"
  echo "  - /feature runs under droxon-agent: spec-kit scaffolding + sdd-* subagents"
  echo "    + YATT + fastloop + dual-judge review on large changes."
  echo "  - spec-kit is used per project: run 'specify init' inside a project that"
  echo "    wants .specify/ scaffolding."
  echo "  - Uninstall: rm the files above, restore *.bak-droxon backups, remove the"
  echo "    yatt entry from opencode.json mcp and the plugin entries."
}

# ----------------------------------------------------------------------------
# Target: Pi Agent
# ----------------------------------------------------------------------------
ensure_pi_cli() {
  if command -v pi >/dev/null 2>&1; then
    log "pi CLI found: $(command -v pi)"
    return 0
  fi
  if ! command -v npm >/dev/null 2>&1; then
    warn "pi CLI not found and npm not available; install Pi first:"
    warn "  npm install -g --ignore-scripts @earendil-works/pi-coding-agent"
    return 1
  fi
  echo "Installing pi CLI (npm install -g --ignore-scripts @earendil-works/pi-coding-agent)..."
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent >/dev/null 2>&1 \
    && command -v pi >/dev/null 2>&1 \
    && log "pi installed: $(command -v pi)" \
    || { warn "pi CLI install failed; install it manually and re-run"; return 1; }
}

pi_install() {
  # pi_install <source> <description> [best-effort]
  local source="$1" desc="$2" best="${3:-}"
  local logfile="${TMPDIR:-/tmp}/droxon-pi-install.log"
  if pi install "$source" >"$logfile" 2>&1; then
    log "pi install ok: $desc ($source)"
  else
    local tail_out
    tail_out="$(tail -3 "$logfile" 2>/dev/null | sed 's/^/    /')"
    if [ "$best" = "best-effort" ]; then
      warn "pi install failed for $desc ($source) — continuing without it"
    else
      warn "pi install failed for $desc ($source)"
    fi
    if [ -n "$tail_out" ]; then
      printf '%s\n' "$tail_out"
    fi
    [ "$best" = "best-effort" ] || return 1
  fi
}

inject_orchestrator_agents_md() {
  local PI_DIR="$1"
  python3 - "$PI_DIR" "$SRC" <<'PYEOF'
import os, shutil, sys
pi_dir, src = sys.argv[1], sys.argv[2]
os.makedirs(pi_dir, exist_ok=True)
path = os.path.join(pi_dir, "AGENTS.md")
if os.path.islink(path):
    # Write through to the real file (dotfiles repos) so content lands where it lives.
    path = os.path.realpath(path)
    print(f"  AGENTS.md is a symlink -> operating on {path}")
block_src = os.path.join(src, "pi", "agents-block.md")
with open(block_src) as f:
    block = f.read().rstrip() + "\n"
START, END = "<!-- droxon-harness:start -->", "<!-- droxon-harness:end -->"
block = f"{START}\n{block}{END}\n"
existing = ""
if os.path.exists(path):
    with open(path) as f:
        existing = f.read()
if START in existing and END in existing:
    pre = existing.split(START, 1)[0]
    post = existing.split(END, 1)[1].lstrip("\n")
    merged = pre + block + post
elif START in existing:
    # Orphan START (truncated previous run): never delete content we cannot
    # attribute to the droxon block — keep everything and append a fresh block.
    merged = existing.rstrip() + "\n\n" + block
else:
    merged = (existing.rstrip() + "\n\n" + block) if existing.strip() else block
if merged == existing:
    print("  AGENTS.md already up to date")
else:
    if os.path.exists(path):
        bak = path + ".bak-droxon"
        if not os.path.exists(bak):
            shutil.copy2(path, bak)  # pristine pre-droxon backup, kept on later runs
            print(f"  (backup: {bak})")
    with open(path, "w") as f:
        f.write(merged)
    print(f"  AGENTS.md: droxon orchestrator block merged ({'replaced' if START in existing else 'appended'})")
PYEOF
}

install_pi() {
  local PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
  echo "==> Droxon harness [Pi Agent -> $PI_DIR]: installing Pi package..."

  if [ ! -f "$SRC/pi/prompts/feature.md" ]; then
    warn "pi/ resources missing in $SRC — this checkout is incomplete"; return 1
  fi

  if command -v pi >/dev/null 2>&1; then
    # The repo itself is the Pi package (pi manifest in package.json); a local
    # install loads resources in place and declares it in settings.json.
    pi_install "$SRC" "droxon-harness (prompts + skills + extension)" || return 1
  else
    warn "pi CLI not available; installing agent-dir files manually (best effort)"
    mkdir -p "$PI_DIR/prompts" "$PI_DIR/skills" "$PI_DIR/extensions"
    cp "$SRC/pi/prompts/feature.md" "$PI_DIR/prompts/feature.md"
    for d in "$SRC"/pi/skills/*/; do
      mkdir -p "$PI_DIR/skills/$(basename "$d")"
      cp "$d"SKILL.md "$PI_DIR/skills/$(basename "$d")/SKILL.md"
    done
    cp "$SRC/pi/extensions/"*.ts "$PI_DIR/extensions/" 2>/dev/null || true
  fi

  inject_orchestrator_agents_md "$PI_DIR"

  if [ "$SKIP_DEPS" != "1" ]; then
    if ensure_pi_cli; then
      echo "==> Dependencies: pi-subagents (subagent delegation for Pi)..."
      pi_install "npm:pi-subagents" "pi-subagents" best-effort
      echo "==> Dependencies: pi-mcp-adapter (exposes MCP servers like YATT to Pi)..."
      pi_install "npm:pi-mcp-adapter" "pi-mcp-adapter" best-effort
      log "note: register the YATT MCP server with pi-mcp-adapter pointing at:"
      log "  bun run $YATT_HOME/mcp/src/server.ts --root $YATT_HOME"
    fi
    echo "==> Dependencies: YATT (E2E browser verification; shared with OpenCode)..."
    ensure_yatt_repo
    echo "==> Dependencies: spec-kit (optional spec scaffolding)..."
    ensure_speckit
  else
    echo "==> Skipping dependencies (DROXON_SKIP_DEPS=1)"
  fi

  warn "skipped: opencode-fastloop (OpenCode-only completion gate). In Pi, the"
  warn "  verification gate runs via the droxon-harness extension (/droxon-verify)."
  warn "skipped: TUI logo (OpenCode-specific; Pi themes have no custom logo)."

  echo "==> Done. Installed (Pi Agent):"
  log "Pi package: droxon-harness -> /feature prompt + droxon-orchestrator skill + droxon-verify extension"
  log "AGENTS.md: droxon orchestrator block (backup .bak-droxon)"
  [ "$SKIP_DEPS" != "1" ] && log "deps: pi-subagents + pi-mcp-adapter (best effort) + YATT ($YATT_HOME) + spec-kit"

  echo
  echo "Restart Pi (or run /reload). Notes:"
  echo "  - /feature runs the full Droxon workflow; delegation uses pi-subagents."
  echo "  - /droxon-verify runs the project's real build/typecheck gate."
  echo "  - Uninstall: pi remove \"$SRC\" (or its settings.json entry), remove"
  echo "    pi-subagents / pi-mcp-adapter, and restore AGENTS.md.bak-droxon."
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      [ $# -ge 2 ] || { echo "ERROR: --target requires a value (opencode|pi)." >&2; exit 2; }
      TARGET="$2"; shift 2 ;;
    --target=*)
      TARGET="${1#--target=}"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if [ -z "$TARGET" ] && [ -n "${DROXON_TARGET:-}" ]; then
  TARGET="$DROXON_TARGET"
fi
if [ -n "$TARGET" ]; then
  case "$TARGET" in
    opencode|pi) ;;
    *) echo "ERROR: invalid target: '$TARGET' (expected opencode or pi)." >&2; usage >&2; exit 2 ;;
  esac
fi

select_target

case "$TARGET" in
  opencode) install_opencode ;;
  pi)       install_pi ;;
esac
