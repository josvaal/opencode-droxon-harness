# OpenCode v2 plugin contract (v2.0.22, verified against the binary)

Date: 2026-10-05. Trigger: `droxon-harness.ts` failed to load with
"Plugin must export a default definition with an id and an effect or setup
function" (ref err_d0eaf47e) after OpenCode upgraded to v2.0.22.

## What changed in v2

- The v1 plugin format (named export `const X: Plugin = async ({client}) => ({hooks})`,
  with default export of the factory) is GONE. The server runtime validates the
  module's default export: object with `id` (non-empty string) and `setup`
  (function) — or `effect` (Effect-style). Validator extracted from the binary:
  `typeof d==="object" && "id" in d && typeof d.id==="string" && d.id.length>0 && "setup" in d && typeof d.setup==="function"`.
- The v1 hook names (`chat.message`, `tool.execute.before`,
  `experimental.chat.system.transform`, `chat.params`, …) appear ZERO times in
  the v2.0.22 bundle. They do not exist.
- Setup context (adapted from `setup(ctx)` in the binary) is domain-based:
  `agent`, `aisdk`, `command`, `event`, `model`, `provider`, `integration`,
  `mcp`, `permission`, `plugin`, `reference`, `skill`, `storage`, `tool`,
  `vcs`, `session`, `shell` (+app/location/options). `setup` may return a
  dispose function.
- The repo's published `.d.ts` (both `@opencode-ai/plugin` 1.18.18 and the
  GitHub 2.0 branch tip) LAGS the shipped binary. Don't trust them; verify
  against the binary (`rg -a` over `~/.opencode/bin/opencode`) or the runtime.

## v1 → v2 hook mapping (used by plugin/droxon-harness.ts)

| v1 | v2 |
|---|---|
| `tool.execute.before` (`input.tool==="task"`) | `ctx.tool.hook("execute.before", ({tool, sessionID, input}) => …)` — args object is mutable (`input.input.prompt`). Tool renamed: **`subagent`** (`opencode.tool.subagent`); `task` only as deprecated alias. |
| `chat.message` (record family per session) | `ctx.event.subscribe(handler)` — decoded events `{type, properties:{sessionID, info}}` (defensively also read flattened). `message.updated` + `info.role==="user"|"assistant"` carries `info.model {providerID, modelID}`. |
| `experimental.chat.system.transform` (push Qwen block) | `ctx.aisdk.hook("language", input => input.language = wrapper)` — hook input `{model{providerID, modelID, id, settings}, sdk, language?}`. CAUTION: resolved language model is CACHED per provider+model+settings (not per request), so per-request injection must happen inside a `doStream`/`doGenerate` wrapper. Family detection is model-based, so this is semantically equivalent to v1. System message shape: `{role:"system", content:string}` prepended to `options.prompt` array. |

## Verification recipe (real gate)

1. `bunx tsc --noEmit` strict over the plugin (self-contained types; no SDK
   type imports — the runtime context is typed structurally in-file).
2. Real load: the running background service file-watches `plugins/` and hot
   reloads; success = `msg="loading plugin" id=…/droxon-harness.ts` in
   `~/.local/share/opencode/log/opencode.log` with NO subsequent
   `"failed to load plugin" target=…/droxon-harness.ts`.
3. `opencode plugin list` does NOT show file plugins — not a valid gate.

## Whole-harness migration (2026-10-05, harness v1.1.0)

Audited every OpenCode-facing piece for v2.0.22:

- `tests/family.spec.ts`: plugin block rewritten to the setup(ctx) contract
  with stub domains (33/33 green); `tests/test-family.sh` greps now pin the v2
  wiring; `tests/test-install.sh` needed no changes (69/69).
- Docs: `docs/harness.md` §Qwen family + README describe the v2 mechanics and
  require OpenCode ≥ 2.0; `package.json` bumped to 1.1.0 + keyword
  `opencode-v2`.
- Verified NON-changes (do not "fix" these later):
  - `tui/droxon-logo.tsx` already matches v2 `TuiPluginModule = {id?, tui}`;
    the `home_logo` slot still exists.
  - Agent frontmatters keep `permission.task` — the v2.0.22 runtime permission
    schema is read/edit/glob/grep/list/bash/**task**/external_directory/
    question/webfetch/websearch/lsp/doom_loop/skill (extracted from the
    binary). The `subagent` rename applies to the TOOL id, not the permission
    key. (`Config.Command` did rename `subtask`→`subagent`, but feature.md
    never used it.)
  - `pi/` targets the Pi host — unaffected by OpenCode v2; its `task` tool
    naming is Pi's, correct as-is.
- Redeployed via `DROXON_SKIP_DEPS=1 ./install.sh --target opencode`; the
  running service hot-reloaded the plugin twice with zero load errors.

## Residual risk (declared, not verified live)

Hook registrations are load-validated but not yet exercised end-to-end in a
real model session (subagent spawn → REMINDER appended; qwen model → block in
system prompt). Handlers are try/catch-wrapped so a shape change degrades to
"no injection", never a host crash.
