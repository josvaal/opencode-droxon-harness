#!/usr/bin/env bash
# opencode-droxon-harness — install-and-play installer.
#
# Installs into OpenCode's global config (~/.config/opencode, override with
# OPENCODE_CONFIG_DIR):
#   agent/*.md                Droxon-Agent + sdd-* + jd-judges
#   command/feature.md        /feature command
#   plugins/droxon-harness.ts task-prompt contract hook
#   tui-plugins/droxon-logo.tsx + tui.json registration
# And automatically sets up the dependencies:
#   - opencode-fastloop (npm plugin; completion gate)
#   - YATT MCP server   (github.com/josvaal/yatt; E2E browser verification)
#   - spec-kit / specify CLI (github.com/github/spec-kit; optional scaffolding)
# Finally: default_agent = droxon-agent, gentle-orchestrator removed (backup kept).
set -euo pipefail

DEST="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
SRC="$(cd "$(dirname "$0")" && pwd)"
YATT_HOME="${YATT_HOME:-$HOME/.local/share/yatt}"
SKIP_DEPS="${DROXON_SKIP_DEPS:-0}"

log()  { printf '  %s\n' "$*"; }
warn() { printf '  WARNING: %s\n' "$*"; }

# ----------------------------------------------------------------------------
# Dependency: bun (required by the YATT MCP server)
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

# ----------------------------------------------------------------------------
# Dependency: opencode-fastloop (npm plugin — completion gate)
# ----------------------------------------------------------------------------
ensure_fastloop() {
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

# ----------------------------------------------------------------------------
# Dependency: YATT (clone + bun install + register as local MCP server)
# ----------------------------------------------------------------------------
ensure_yatt() {
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

# ----------------------------------------------------------------------------
# Dependency: spec-kit / specify CLI (optional scaffolding)
# ----------------------------------------------------------------------------
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
# Harness files
# ----------------------------------------------------------------------------
install_harness() {
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
    shutil.copy2(path, path + ".bak-droxon")
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
    print(f"  (backup: {path}.bak-droxon)")
else:
    print("  agent config already up to date")
PYEOF
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
echo "==> Droxon harness: installing harness files..."
install_harness

if [ "$SKIP_DEPS" != "1" ]; then
  echo "==> Dependencies: opencode-fastloop (completion gate)..."
  ensure_fastloop
  echo "==> Dependencies: YATT (E2E browser verification)..."
  ensure_yatt
  echo "==> Dependencies: spec-kit (optional spec scaffolding)..."
  ensure_speckit
else
  echo "==> Skipping dependencies (DROXON_SKIP_DEPS=1)"
fi

echo "==> Done. Installed:"
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
