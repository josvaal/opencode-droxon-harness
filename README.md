# opencode-droxon-harness

One OpenCode agent that contains the whole harness: **Droxon-Agent**, an orchestrator that
delegates the SDD pipeline to shipped subagents, drives spec-kit (`speckit`) when the project
has `.specify/`, enforces interactive ⛔ gates, and merges the verification stack —
**tests + fastloop + YATT + dual-judge adversarial review** — before anything is called done.

Model-agnostic for the **GLM and Qwen families**: the harness detects the model family on every
prompt (OpenCode plugin / Pi extension) and adapts; no model version is hardcoded in prompts,
per-model knobs live in config.

```
⠀⠀⢀⣤⣶⣶⣦⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣶⠆⠀⠀⠀⠀
⠀⣰⣿⣿⠟⠛⠻⢿⣿⣄⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⠃⠀⠀⠀⠀⠀
⢠⣿⣿⠃⠀⠀⠀⠀⠹⣿⣷⡀⠀⠀⢀⣾⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀
⠈⠉⠉⠀⠀⠀⠀⠀⠀⠙⣿⣷⡀⢀⣾⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣷⣾⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⠏⠸⣿⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⠏⠀⠀⢹⣿⣿⡀⠀⠀⠀⠀⠀⣿⣿⡇
⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⠋⠀⠀⠀⠀⢻⣿⣷⡀⠀⠀⠀⣰⣿⣿⠀
⠀⠀⠀⠀⠀⣰⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠙⣿⣿⣦⣤⣴⣿⣿⠃⠀
⠀⠀⠀⠀⠰⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠻⠿⠟⠛⠁⠀⠀
```

## What ships

| Piece | File | What it does |
|---|---|---|
| **Droxon-Agent** | `agent/droxon-agent.md` | Primary orchestrator: delegates heavy phases to `sdd-*` subagents, drives the `/feature` workflow, enforces gates, runs the verification contract, keeps file-based memory (`MEMORY.md`). Never commits, pushes, or opens PRs — git delivery is yours. |
| **sdd-\* subagents** | `agent/sdd-*.md` | Copies of the 11 SDD phase agents (init, explore, propose, research, spec, design, tasks, apply, verify, archive, onboard) so the plugin is self-contained. |
| **jd-judges** | `agent/jd-judge-{a,b}.md` | Blind dual adversarial reviewers, launched on large/risky changes as part of the closure gate. |
| **/feature** | `command/feature.md` | End-to-end feature workflow: YATT E2E reproduction before reading code, verbatim brief, case enumeration with a mandatory checklist, ⛔ GATE 1 (clarification) and ⛔ GATE 2 (per-case closure), spec-kit fusion, per-layer verification, short mode with an uncompressable GATE 2. |
| **Prompt-contract hook** | `plugin/droxon-harness.ts` | Appends a self-contained contract to every `task` subagent prompt (conventions verbatim, faithful reporting, complete final message) — subagents have no parent memory, so the contract travels with them. |
| **TUI logo** | `tui/droxon-logo.tsx` | Replaces the OpenCode home logo with the Droxon ASCII art (compact fallback on small terminals). |
| **Pi package** | `pi/` | The same harness for [Pi Agent](https://pi.dev): `/feature` prompt template, `droxon-orchestrator` skill, `droxon-verify` extension (real-build completion gate), orchestrator AGENTS.md block. Installed by `install.sh --target pi` via `pi install` + `npm:pi-subagents`. |

Design docs (how the behavior was derived): [`docs/harness.md`](docs/harness.md) and
[`docs/harness-core.md`](docs/harness-core.md).

## Install (and play)

```bash
git clone https://github.com/josvaal/opencode-droxon-harness.git
cd opencode-droxon-harness
./install.sh
```

The installer asks which coding agent to install into:

```
==> Which coding agent do you want to install the Droxon harness into?
  (1) OpenCode
  (2) Pi Agent
Choice [1-2]:
```

For CI and scripting, skip the menu with `--target opencode|pi` (or
`DROXON_TARGET=opencode|pi`). See `./install.sh --help`.

### Target 1: OpenCode

The installer is **install-and-play**: besides copying the harness into
`~/.config/opencode/` (override with `OPENCODE_CONFIG_DIR`), it sets up the
dependencies automatically:

- **opencode-fastloop** — adds `opencode-fastloop/server` to `opencode.json` and
  `opencode-fastloop` to `tui.json` (OpenCode installs the npm packages at startup).
- **YATT** — clones [josvaal/yatt](https://github.com/josvaal/yatt) to
  `~/.local/share/yatt` (override with `YATT_HOME`), runs `bun install` in `mcp/`
  (installing bun first if missing), and registers it as a local MCP server in
  `opencode.json`.
- **spec-kit** — installs `uv` if missing, then the `specify` CLI from
  [github/spec-kit](https://github.com/github/spec-kit). Optional: `/feature`
  uses it only in projects that ran `specify init`.

It also sets `"default_agent": "droxon-agent"`, registers the TUI logo in
`tui.json`, and keeps a `.bak-droxon` backup of every config file it touches.
Every step is idempotent — re-running is safe. Skip dependencies with
`DROXON_SKIP_DEPS=1 ./install.sh`. Restart OpenCode when it finishes.

### Target 2: Pi Agent

The harness installs as a **Pi package** ([pi.dev/packages](https://pi.dev/packages))
into the Pi agent dir (`~/.pi/agent`, override with `PI_CODING_AGENT_DIR`):

- **`pi install <this repo>`** — the repo itself is a Pi package (`pi` manifest
  in `package.json`): the `/feature` prompt template, the
  `droxon-orchestrator` skill, and the `droxon-harness` extension load in place.
- **`pi install npm:pi-subagents`** — subagent delegation for Pi (the
  equivalent of OpenCode's `task` tool), plus `npm:pi-mcp-adapter` (best
  effort) so the YATT MCP server can be exposed to Pi.
- **AGENTS.md** — the orchestrator core is merged into `~/.pi/agent/AGENTS.md`
  (existing content preserved; backup `AGENTS.md.bak-droxon`).
- **YATT + spec-kit** — same shared dependencies as OpenCode (YATT cloned to
  `$YATT_HOME`, spec-kit via `uv`).
- With the `pi` CLI present, the package **loads in place** from this repo
  (nothing is copied into the agent dir — Pi resolves it by absolute path), so
  keep the clone where it is; deleting it uninstalls the resources. Without
  the `pi` CLI, the installer falls back to copying the resources into the
  agent dir manually (`npm install -g --ignore-scripts
  @earendil-works/pi-coding-agent` is attempted first if npm exists).

Not portable to Pi (skipped with a notice): **opencode-fastloop** (the
completion gate runs instead via the `droxon-harness` extension's
`/droxon-verify` command, which resolves and runs the project's real
build/typecheck gate) and the **TUI logo** (Pi themes have no custom logo).

Restart Pi (or run `/reload`) when it finishes.

### Verification

```bash
npm test          # or: ./tests/test-install.sh
```

Installs into temp dirs (never your real config) and covers both targets:
menu/flags, no-regression for OpenCode, Pi package resources, AGENTS.md merge
and backups, idempotency, and graceful degradation without bun/npm/pi.

### Uninstall (OpenCode)

Remove the installed files (the installer prints the exact list), restore
`opencode.json` / `tui.json` from the `.bak-droxon` backups, and drop the `yatt`
entry from `opencode.json` `mcp` if you don't want it anymore.

### Uninstall (Pi)

`pi remove <path to this repo>` (or drop the entry from
`~/.pi/agent/settings.json`), remove `pi-subagents` / `pi-mcp-adapter`, and
restore `~/.pi/agent/AGENTS.md.bak-droxon`.

## Requirements

| Dependency | Why | Source |
|---|---|---|
| [YATT](https://github.com/josvaal/yatt) | E2E browser verification: reproduce bugs before reading code, persist repros as tests, measure UI in a real browser (rects, overflow, dark mode). Gated by `yatt_ping` — if absent, UI verification is explicitly deferred, never silently skipped. | [github.com/josvaal/yatt](https://github.com/josvaal/yatt) |
| [opencode-fastloop](https://github.com/josvaal/opencode-fastloop) | The completion gate: `fastloop_verify` runs per-repo typechecks and nothing is "done" without it green. | [github.com/josvaal/opencode-fastloop](https://github.com/josvaal/opencode-fastloop) |
| [spec-kit](https://github.com/github/spec-kit) (optional) | When the project contains `.specify/`, `/feature` drives the `speckit` workflow (specify → plan → tasks → implement) for spec scaffolding. Without it, the feature artifacts in `features/<slug>/` stand alone. | [github.com/github/spec-kit](https://github.com/github/spec-kit) |
| sdd-\* skills (optional) | The shipped `sdd-*` subagent stubs load companion `sdd-*` skills; without them the agents still run but with their fallback instructions. | included in your OpenCode skills setup |

## How it behaves

- **Trivial change** → fixed inline, verified, done.
- **Question / exploration** → conversational answer, no structure, no gates.
- **`/feature <request>`** → the full workflow:

```
FASE 0  reproduce the bug with YATT (never diagnose from code first)
FASE 1  context: verbatim brief + deep exploration (sdd-explore) + visual pass
FASE 2  cases.md: traceability (every requirement ≥1 case) + mandatory checklist
 ⛔ GATE 1  clarifications — numbered questions, enumerable options, STOP
FASE 3  plan.md: every case covered by ≥1 task and ≥1 named test (sdd-tasks)
FASE 4  implement (sdd-apply): tests first, fastloop_verify green per task
 ⛔ GATE 2  closure: per-case status, YATT green, browser measurement,
            dual-judge review on large diffs, verification.md evidence
```

Gates are interactive: at a ⛔ the agent ends its turn and waits. No automatic mode.

## License

[MIT](LICENSE)
