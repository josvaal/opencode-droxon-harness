---
name: qwen-model-family-support
description: "Qwen family support: per-prompt silent model-family detection + Qwen-only intelligence injection; dynamic import cascade for 4 install layouts; dual-review caught a real fallback-layout break"
type: decision
---

# Qwen model-family support (2026-09-25)

**What**: The harness now detects the model family (GLM vs Qwen) per prompt, silently, in both
targets: OpenCode plugin (`chat.message` + `experimental.chat.system.transform`) and Pi
(`before_agent_start` + `ctx.model`). ONLY detected-Qwen sessions get injected intelligence
(system block + subagent note); GLM/unknown keep byte-identical behavior (user decision 2b).
Detection (modelID regex first, then endpoint) lives in ONE shared data module,
`plugin/model-family.ts`. Distilled Qwen behavior from the official qwen-code harness (docs/qwen-notes.md).

**Why**: The user wanted family-appropriate "intelligence" per prompt (feature
`features/qwen-model-family-support/`). qwen-code gates behavior by model-name regex — that's
the proven pattern, mirrored here. GATE 1 decisions (1a/2b/3a/4a): distilled block not calque;
unknown = today's behavior; installer stays out of connection/auth; silent.

**Where**: `plugin/model-family.ts` (shared module) · `plugin/droxon-harness.ts` ·
`pi/extensions/droxon-harness.ts` · `install.sh` (stages module at `$DEST/lib/` for OpenCode and
agent-dir root for Pi fallback — both OUTSIDE auto-load dirs) · `tests/family.spec.ts` (30 specs
incl. hook-level wiring) · `tests/test-family.sh` (wired into `npm test`) · docs/qwen-notes.md.

**Learned**:
- Dynamic import CASCADE beats static relative imports for multi-layout packages: one module,
  specifier list per deployment shape, silent degrade to "feature off" — the host never crashes.
- Put non-plugin data modules OUTSIDE auto-load directories (OpenCode loads everything in
  `plugins/`; Pi everything in `extensions/`): loaders may invoke/choke on non-factory exports.
- Blind dual review paid off again: BOTH judges independently found the Pi-fallback layout break
  (static import + staged-alone extension = unloadable) that all green gates missed. Gates prove
  what runs; judges prove what ships.
- Detection asymmetry rule: when two hooks see different model signals (modelID-only vs full
  model+endpoint), let the richer signal record too — but never let an EMPTY signal overwrite a
  detected one (no-flip guard).
