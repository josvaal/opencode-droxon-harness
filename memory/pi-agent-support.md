---
name: pi-agent-support
description: Droxon harness now installs into Pi Agent (dual-target installer); key mechanisms, gotchas and judge findings from the port.
type: decision
---

# Pi Agent support shipped (2026-09-23)

**What**: `install.sh` is dual-target: menu (1) OpenCode (2) Pi Agent, `--target opencode|pi`, `DROXON_TARGET` env (flag wins over env, invalid → exit 2). The repo itself is a **Pi package** (`"pi"` manifest in package.json: `pi/prompts/feature.md`, `pi/skills/droxon-orchestrator/SKILL.md`, `pi/extensions/droxon-harness.ts`, keyword `pi-package`). Pi install = `pi install <repo>` (loads IN PLACE — deleting the clone uninstalls) + `pi install npm:pi-subagents` + `npm:pi-mcp-adapter` (best effort) + orchestrator block merged into `~/.pi/agent/AGENTS.md` + shared YATT/spec-kit. fastloop and TUI logo are OpenCode-only (skipped with notices; `/droxon-verify` extension is the Pi completion gate).

**Why**: user request; Pi has no subagents/MCP natively — those come from catalog packages.

**Where**: `install.sh`, `pi/*`, `tests/test-install.sh` (`npm test`, 67 asserts, temp dirs, mocked pi/bun/git/curl/uv — zero network), `docs/zcode-notes.md`, README.

**Learned**:
- `.bak-droxon` backups must be created ONLY if absent (pristine pre-droxon state); otherwise the 2nd idempotent run overwrites the backup with an already-patched config.
- Under `set -euo pipefail`, `[ cond ] && cmd` as the last statement of a function aborts the caller when cond is false — use `if`.
- `pi install <local path>` loads in place and does NOT copy into the agent dir; only the manual fallback (no pi CLI) copies.
- Ports must not reference roles that don't exist in the target: sdd-*/jd-judge are OpenCode-only; in Pi the role instructions travel inside the pi-subagents delegation prompt.
- AGENTS.md merge: resolve symlinks (realpath) before writing; orphan START marker (no END) must append, never delete unattributed content.
- `env PATH=... cmd` misbehaves in this sandbox — use `( PATH=...; cmd )` subshells in tests.
