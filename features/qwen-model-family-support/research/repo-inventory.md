# Repo Inventory — droxon-harness (for Qwen model-family support feature)

Read-only scout report. All facts cited with file:line or doc path. Note: the repo has **14** agent files (droxon-agent, jd-judge-a/b, 11 sdd-*), not 15.

---

## 1. GLM touchpoints (every GLM / model-family / model-name mention)

Prose/markdown (all files scanned; the following are the ONLY hits in the target set):

| File:line | Verbatim quote |
|---|---|
| `agent/droxon-agent.md:2` | `description: Droxon Orchestrator — ... Primary agent, GLM-family friendly.` |
| `agent/droxon-agent.md:28` | `You run on the GLM model family; your discipline comes from gates and tools, not from hoping the model remembers.` |
| `agent/droxon-agent.md:256` | `GLM emits reasoning the user never sees: EVERYTHING the user needs must be in the final message` |
| `agent/droxon-agent.md:262` | `Model-agnostic for the GLM family: never hardcode a model version; per-model knobs live in config, not prose.` |
| `README.md:8-9` | `Model-agnostic for the **GLM family**: pick any GLM in \`opencode.json\`; no model version is hardcoded in prompts, per-model knobs live in config.` |
| `package.json:4` | description: `... GLM-family friendly.` |
| `package.json:39` | keyword `"glm"` |
| `docs/harness.md:1` | `# OpenCode Harness (GLM family) — YATT · /feature · fastloop` |
| `docs/harness.md:5` | `Model-agnostic for the GLM family.` |
| `docs/harness.md:70` | `...for a flash-tier GLM this matters more than paraphrasing` |
| `docs/harness.md:165-168` | `# GLM notes` / `GLM emits reasoning parts the user never sees; the final message carries the deliverable.` / `Order stable instructions first, volatile context last (prompt-cache friendly).` |
| `docs/harness.md:174-204` | `## 5. GLM family compatibility (model-agnostic)` — full section: provider wiring (`@ai-sdk/openai-compatible` vs `https://api.z.ai/api/paas/v4`, coding-plan variant, `https://api.z.ai/api/anthropic`); "Tiers, not versions" (flash-tier → all countermeasures; thinking tier; pro tier); "Per-model knobs live in config (temperature/maxTokens/topP in opencode.json or \`model-variants.ts\`)"; cache discipline; swap checklist (`update model ID → smoke feature through /feature → confirm fastloop + YATT → done. Harness, command, plugin: untouched.`); §6 ends `...it survives any GLM swap.` |
| `docs/harness-core.md:3` | `Distilled from /opt/ZCode/resources/glm/zcode.cjs` |
| `docs/harness-core.md:309` | `## 5. Applying this to OpenCode + glm-5.3-flash` |
| `docs/harness-core.md:328-330` | `For glm-5.3-flash specifically: keep the temperature low ... openai-compatible provider pointed at the GLM endpoint (https://api.z.ai/api/paas/v4 or the coding-plan variant)` |
| `docs/zcode-notes.md` | No GLM/model-family mentions (Spanish retro notes on ZCode conventions only). |

**Explicit negative results (grep-verified):**
- `agent/jd-judge-a.md`, `jd-judge-b.md`, all 11 `agent/sdd-*.md` (apply, archive, design, explore, init, onboard, propose, research, spec, tasks, verify): **zero** GLM/model mentions.
- `command/feature.md`, `pi/prompts/feature.md`, `pi/skills/droxon-orchestrator/SKILL.md`, `pi/agents-block.md`: **zero** GLM/model mentions.
- `install.sh`, `plugin/droxon-harness.ts`, `pi/extensions/droxon-harness.ts`, `tests/test-install.sh`: **zero** GLM/model mentions.
- `memory/*.md` (harness-rules-from-gym-postmortem.md, pi-agent-support.md): **zero** GLM mentions.
- `features/pi-agent-support/*.md`: no GLM tuning; they document portability only.

**Behavioral GLM dependence is concentrated in exactly 2 prose spots**: `agent/droxon-agent.md:256` (hidden-reasoning assumption → final-message contract) and `docs/harness.md:165-168` (same). Everything else is family-level framing.

## 2. OpenCode interception mechanics

### (a) Hook used today
`plugin/droxon-harness.ts:25-32`: exactly ONE hook, `"tool.execute.before"`, filtered to `input.tool !== "task"`, appending a `REMINDER` string to `output.args.prompt`. Registered via `export const DroxonHarnessPlugin: Plugin = async () => ({ "tool.execute.before": ... })` (`@opencode-ai/plugin` import at line 1). Installed as `~/.config/opencode/plugins/droxon-harness.ts` (install.sh:170).

### (b) OpenCode plugin API — types ARE installed locally
Found at `/home/codicore/.config/opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts` (with `v2/` promise-type submodules and `tui.d.ts`). **The full `Hooks` interface (lines 170-312), quoted signatures:**

```ts
export interface Hooks {
    event?: (input: { event: Event }) => Promise<void>;
    config?: (input: Config) => Promise<void>;
    tool?: { [key: string]: ToolDefinition };
    auth?: AuthHook;
    provider?: ProviderHook;   // models?(provider, ctx) — custom model catalog

    /** Called when a new message is received */
    "chat.message"?: (input: {
        sessionID: string;
        agent?: string;
        model?: { providerID: string; modelID: string };
        messageID?: string;
        variant?: string;
    }, output: { message: UserMessage; parts: Part[] }) => Promise<void>;

    /** Modify parameters sent to LLM */
    "chat.params"?: (input: {
        sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage;
    }, output: { temperature: number; topP: number; topK: number; maxOutputTokens: number | undefined;
        options: Record<string, any> }) => Promise<void>;

    "chat.headers"?: (input: { sessionID: string; agent: string; model: Model; provider: ProviderContext;
        message: UserMessage }, output: { headers: Record<string, string> }) => Promise<void>;

    "permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>;
    "command.execute.before"?: (input: { command: string; sessionID: string; arguments: string },
        output: { parts: Part[] }) => Promise<void>;

    "tool.execute.before"?: (input: { tool: string; sessionID: string; callID: string },
        output: { args: any }) => Promise<void>;
    "shell.env"?: (input: { cwd: string; sessionID?: string; callID?: string },
        output: { env: Record<string, string> }) => Promise<void>;
    "tool.execute.after"?: (input: { tool: string; sessionID: string; callID: string; args: any },
        output: { title: string; output: string; metadata: any }) => Promise<void>;

    "experimental.chat.messages.transform"?: (input: {}, output: { messages: { info: Message; parts: Part[] }[] }) => Promise<void>;
    "experimental.chat.system.transform"?: (input: { sessionID?: string; model: Model },
        output: { system: string[] }) => Promise<void>;
    "experimental.session.compacting"?: (input: { sessionID: string }, output: { context: string[]; prompt?: string }) => Promise<void>;
    "experimental.compaction.autocontinue"?: (input: { sessionID: string; agent: string; model: Model;
        provider: ProviderContext; message: UserMessage; overflow: boolean }, output: { enabled: boolean }) => Promise<void>;
    "experimental.text.complete"?: (input: { sessionID: string; messageID: string; partID: string },
        output: { text: string }) => Promise<void>;
    "tool.definition"?: (input: { toolID: string }, output: { description: string; parameters: any }) => Promise<void>;
}
```

**Model-family detection surface (OpenCode):**
- `"chat.message"` fires **per user message received** and its input exposes `model?: { providerID: string; modelID: string }` — direct per-prompt family detection.
- `"chat.params"`, `"chat.headers"`, `"experimental.chat.system.transform"` all expose the full `model: Model` in input and can influence the request/params/system prompt. `experimental.chat.system.transform` output is `system: string[]` — the system-prompt rewrite hook.
- The generic `event` hook receives all SDK `Event`s (types come from `@opencode-ai/sdk`, also present under `~/.config/opencode/node_modules/@opencode-ai/sdk` — not inspected in detail; `Model`, `Provider` types re-exported at index.d.ts:1).

**Live machine config** (`~/.config/opencode/opencode.json`): has `"default_agent": "droxon-agent"`, `"plugin": ["caveman-opencode-plugin@latest", "opencode-fastloop/server"]`, `mcp` (todo-reactiva, context7, render-component, yatt), `agent.*` definitions (sdd-*, jd-*, review-*, fallbacks), permissions — but **NO `"model"` key at top level** (model selection is not persisted there in the current install). `tui.json` exists with the droxon-logo plugin entry.

## 3. Pi extension mechanics

Source docs: `/home/codicore/.nvm/versions/node/v22.23.2/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` and types at `.../dist/core/extensions/types.d.ts` (all quotes verbatim from these two).

### (a) Knowing the CURRENT session model
- `ExtensionContext` has `model: Model<any> | undefined` — `/** Current model (may be undefined) */` (types.d.ts:223-224), plus `getModel: () => Model<any> | undefined` (types.d.ts:1348).
- Event `model_select` — `/** Fired when a new model is selected */`: `{ type: "model_select"; model: Model<any>; previousModel: Model<any> | undefined; source: ModelSelectSource }` where `ModelSelectSource = "set" | "cycle" | "restore"` (types.d.ts:697-703).
- `pi.setModel(model): Promise<boolean>` exists (`Set the model for the current session without changing the configured default for new sessions. Returns false if authentication is not configured for the model's provider.` — types.d.ts:1078-1081). `Model` carries `id`, `provider`, `baseUrl` overrides etc. (provider/model config types types.d.ts:1168-1234).

### (b) Per-prompt / per-loop hooks
- `before_agent_start` — `/** Fired after user submits prompt but before agent loop. */`:
```ts
export interface BeforeAgentStartEvent {
    type: "before_agent_start";
    prompt: string;                       // raw user prompt text (after expansion)
    images?: ImageContent[];
    readonly systemPrompt: string;        // current system prompt after earlier handlers
    systemPromptOptions: NormalizedBuildSystemPromptOptions;  // mutable prompt sections
}
```
(types.d.ts:555-566). This is the per-user-prompt interception point (already used conceptually by pi-subagents/other extensions; NOT used by droxon-harness.ts today — the Pi extension only registers the `droxon-verify` command).
- `agent_start` (`type: "agent_start"`, no payload, types.d.ts:567-570), `turn_start` (`{ type: "turn_start"; turnIndex: number; timestamp: number }`, types.d.ts:643-647), `agent_end`, `turn_end`, `message_start/update/end`, `tool_call`/`tool_result` also exist.
- extensions.md:101: "`before_agent_start` exposes both the current prompt and its structured `systemPromptOptions`. Prefer changing prompt sections... Returning `systemPrompt`, or setting `forceSystemPrompt`, replaces the whole prompt for that run."

### (c) Injecting context / modifying system prompt
- In `before_agent_start`, mutate `systemPromptOptions` (sections/tools/guidelines) → transcript delta appended; or return `systemPrompt` / `forceSystemPrompt` → whole-prompt replacement for that run (extensions.md:101; types.d.ts:560-565).
- `pi.appendEntry(customType, data?)` (types.d.ts:1060) — durable data excluded from model context; `pi.sendMessage(message, options?)` (types.d.ts:299, 1046) — custom content stored AND sent to the model (extensions.md:170-172).
- `ctx.getSystemPrompt: () => string` (types.d.ts:1358) to read the rendered prompt.
- Static config alternative: `SYSTEM.md` replaces Pi's system prompt, `APPEND_SYSTEM.md` appends, at agent-dir or project `.pi/` level (docs/configuration.md:18-31; `defaultModel` setting in docs/settings.md:12). Not used by this repo today.

## 4. install.sh — what it writes, and where per-family config could live

**OpenCode target** (`install_opencode`, install.sh:200-267):
- Copies `agent/*.md` → `~/.config/opencode/agent/`, `command/feature.md`, `plugin/droxon-harness.ts` → `plugins/`, `tui/droxon-logo.tsx` → `tui-plugins/` (lines 155-170).
- Python heredoc on `tui.json`: `plugin += <configdir>/tui-plugins/droxon-logo.tsx`, strips `gentle-logo` (lines 171-190).
- Python heredoc on `opencode.json` (lines 216-240): backup `.bak-droxon` (only if absent), sets **`default_agent: "droxon-agent"`**, deletes `agent["gentle-orchestrator"]`. **It never writes a `model` key** — model selection is left to the user's existing config.
- `ensure_fastloop` (lines 111-146): `opencode.json plugin += "opencode-fastloop/server"`; `tui.json plugin += "opencode-fastloop"`.
- `register_yatt_opencode` (lines 149-…): `opencode.json mcp.yatt = { enabled, type: "local", command: ["bun","run", <YATT_HOME>/mcp/src/server.ts, "--root", YATT_HOME] }`.
- Deps: bun, YATT clone, spec-kit (uv).

**Pi target** (`install_pi`, install.sh:290-…):
- `pi install "$SRC"` (repo itself is a Pi package; loads in place; declares in `~/.pi/agent/settings.json`), fallback manual copy of prompts/skills/extensions.
- `pi install npm:pi-subagents`, `npm:pi-mcp-adapter` (best effort); `inject_orchestrator_agents_md` merges `pi/agents-block.md` between `<!-- droxon-harness:start -->` / `:end -->` markers in `~/.pi/agent/AGENTS.md` with `.bak-droxon` backup and symlink resolution.
- Shared: YATT + spec-kit. Skips fastloop + TUI logo with warnings.

**Natural home for per-model-family config** (factual anchors only): the harness already states the convention "Per-model knobs live in config (temperature/maxTokens/topP in opencode.json or `model-variants.ts`), never in harness prose" (docs/harness.md:189-191), and "A new GLM changes ONE thing: the model ID in config" (docs/harness.md:176). Current install.sh mutates `opencode.json` via idempotent python heredocs — the established pattern for adding a new key (e.g. a family-detection list) there and/or in Pi `settings.json`/AGENTS.md block.

## 5. tests/test-install.sh — assertions today

Helpers: `check`, `check_file`, `check_dir`, `check_no_file`, `check_grep` (lines 28-31). Sections (`==` markers):

- **T-OC (line 54)**: OpenCode tree identical to before — file/dir existence of agent/, command/, plugins/, tui-plugins/; `check_grep "default_agent is droxon-agent" '"default_agent": "droxon-agent"' opencode.json` (line 64); `check_grep "logo registered in tui.json" 'droxon-logo.tsx' tui.json` (line 65); JSON validity of opencode.json + tui.json (line 67).
- **T-MENU (74)**: interactive menu pipe `1`/`2`, EOF → exit≠0, invalid `9` → exit≠0.
- **T-FLAGS (93)**: `--target opencode|pi`, `DROXON_TARGET`, precedence (flag wins), invalid → exit 2; **backup test: fixture writes `{"$schema": ..., "model": "x"}` into a temp opencode.json (line 118) and asserts `'\"model\": \"x\"'` is preserved in `opencode.json.bak-droxon` (line 122)** — the only place the string "model" appears in the test suite.
- (lines 129-136) Pi /feature prompt content: contains `GATE 1`, `GATE 2`, `FASE 4`; does NOT rely on `fastloop_verify`; contains `droxon-verify`, `pi-subagents`.
- **T-PI (152)**: agent-dir resources; AGENTS.md contains `droxon-harness:start`/`:end`, `⛔`, `/feature`.
- (line 170) Pi extension transpiles: `bun build --no-bundle pi/extensions/droxon-harness.ts` (guarded if bun missing).
- **T-MANIFEST (178)**: package.json — `python3` asserts `"pi-package" in pkg["keywords"]` and every `pi` manifest glob path exists.
- **T-PI-REAL (194)**: real `pi install` if CLI present; `settings.json` contains the package (line 206), `pi list` soft-check.
- **T-PI-DEPS (219)**: mocked `pi` failing npm sources → best-effort warnings, exit 0.
- **T-IDEM (257)**: second run = no duplication (AGENTS.md block once, stable tree).
- **T-MERGE (271)**: pre-existing AGENTS.md — `'Be nice.'` preserved (276), block appended (277).
- **T-DEGRADE (282)**: PATH stripped → exit 0, files installed, warnings.

**Qwen-support change break-risk in tests**: T-MANIFEST asserts package.json keywords/manifest only (additive changes safe); nothing asserts the README's GLM wording; the `"model": "x"` at line 118 is a backup fixture, not an assertion about a real `model` key. No test asserts anything GLM-specific.

## 6. House style (features/pi-agent-support/* + memory/pi-agent-support.md)

- **brief.md**: `# Brief — <feature name>`, `Date:` line, `## Pedido original (VERBATIM)` (blockquote quote — Spanish user request kept verbatim), `## Requisitos explícitos extraídos` (numbered list of extracted requirements).
- **context.md**: `Date:`, `## Inventario del repo` (markdown table, columns `Pieza | Archivo | Acoplada a OpenCode`), `## Qué es <target> (verificado en …)`, `## Mapa de portabilidad` (table). Spanish, factual, verification status marked ("verificado"/"No verificado").
- **cases.md**: one-line summary of GATE 1 decisions, then a case table with columns `| ID | Caso | Fuente | Comportamiento esperado | Verificación | Tipo | Estado |` (IDs C1…Cn, Estado `✅`).
- **plan.md**: `T1…T9` tasks, each with bullets `Cubre: C#…` and `Test:` mapping tasks → cases; ends with GATE 2 task.
- **verification.md**: `Date:` + `Suite: npm test → N passed / 0 failed` header; `## Evidencia por caso` table (`| ID | Caso | Estado | Evidencia |`); `## YATT (E2E navegador)` (or "No aplica" justification); `## Review adversarial dual` (judge rounds, verdicts, fixes); `## Cómo reproducir` bash block.
- **memory/pi-agent-support.md**: YAML frontmatter (`name`, `description`, `type: decision`), then `# Title (date)` with `**What**/**Why**/**Where**/**Learned**:` sections; lessons concrete and mechanism-focused.
- **Tone/language**: Spanish prose with English technical terms verbatim (file names, APIs); terse, evidence-first; every claim tied to a file/command; memory entries in English.
- Note: `features/qwen-model-family-support/` already exists with `brief.md` and `research/qwen-code-findings.md` + `sources/` (external research, already done) — new artifacts should follow the pi-agent-support conventions above.

---

## Start Here
`plugin/droxon-harness.ts` (35 lines) for OpenCode and `pi/extensions/droxon-harness.ts` (102 lines) for Pi are the only code files the feature must extend; the per-prompt model identity is exposed by OpenCode's `"chat.message"` / `"chat.params"` hooks and Pi's `before_agent_start` event + `ctx.model`, per sections 2-3 above.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Full 6-section factual inventory written to the authoritative output path with file:line citations, exact quoted hook/event signatures for OpenCode (@opencode-ai/plugin Hooks) and Pi (before_agent_start, model_select, ctx.model), install.sh config-writes, test assertions, and house-style conventions; no repo files modified."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "grep -rniE glm/qwen/model over repo files; reads of plugin, extension, install.sh, tests, docs, pi package .d.ts and docs",
      "result": "passed",
      "summary": "All GLM touchpoints and API surfaces located and quoted"
    }
  ],
  "validationOutput": [
    "OpenCode plugin types found installed at ~/.config/opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts; Pi types at .../@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts"
  ],
  "residualRisks": [
    "Repo has 14 agent/*.md files, not 15 as stated in the task; none of the sdd-*/jd-* files mention GLM",
    "Current ~/.config/opencode/opencode.json has no top-level 'model' key — active-model detection must come from hook/event payloads, not config",
    "@opencode-ai/sdk Event union not enumerated in detail (only re-export referenced at plugin index.d.ts:1)",
    "Runtime output-path override honored: report written to session artifact path, not to features/qwen-model-family-support/research/repo-inventory.md (repo is read-only for this scout); full report is in the final message for the parent to persist"
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo changes; one artifact file written to the session output path",
  "reviewFindings": ["no blockers"],
  "manualNotes": "OpenCode 'experimental.chat.system.transform' (input { sessionID?, model: Model }, output { system: string[] }) is the system-prompt rewrite hook; Pi 'before_agent_start' returning systemPrompt/forceSystemPrompt replaces the whole prompt per run."
}
```
