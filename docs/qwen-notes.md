# Qwen notes

Companion to the GLM notes (`docs/harness.md` §4/§5). Distilled from the official
[qwen-code](https://github.com/QwenLM/qwen-code) harness and Qwen3-Coder docs — the essential
behavior a generic harness must adapt to, not a calque.

## Detection

- Model-ID signal first (it beats the endpoint): `/qwen/i` → Qwen, `/glm/i` → GLM,
  case-insensitive. Silent IDs (kimi, deepseek, GPT…) fall through to the endpoint signal.
- Endpoint signal on providerID+baseUrl: Qwen — `dashscope` / `maas` / `aliyuncs`
  (ModelStudio `https://dashscope.aliyuncs.com/compatible-mode/v1`, Coding Plan
  `https://coding.dashscope.aliyuncs.com/v1` CN / `https://coding-intl.dashscope.aliyuncs.com/v1`
  intl, Token Plan `*.maas.aliyuncs.com`); GLM — `z.ai` (`https://api.z.ai/api/paas/v4`).
- Implemented once in `plugin/model-family.ts`; the OpenCode plugin and the Pi extension both
  import it. Detection runs per prompt and is silent — no runtime announcements.

## Model tiers

- Open-weight Qwen3-Coder instruct models (incl. Qwen3-Coder-Next): non-thinking only — they
  emit no `<think>` blocks and need no `enable_thinking` switch.
- Hosted plus/max tiers (qwen3.5/3.6/3.7-plus, qwen3-max): thinking on by default
  (`extra_body.enable_thinking: true` in qwen-code's own presets).

## Tool-call format

- Qwen coder models use the qwen-coder XML form (the same examples qwen-code embeds for
  `/qwen[^-]*-coder/i` model IDs):
  `<tool_call><function=name><parameter=key>value</parameter></function></tool_call>`

## Limits

- Hosted coder models: max input ~1M tokens (997,952), max output 65,536 — do not assume
  smaller windows. Open-weight Qwen3-Coder: 256K native, 1M with Yarn.

## DashScope quirk

- `tool_choice: "required"` is rejected while thinking mode is active — never force tool
  selection in that combination (qwen-code drops forced selection on DashScope for this reason).

## Auth reality

- Alibaba ModelStudio / Coding Plan API keys (Coding Plan keys carry the `sk-sp-` prefix;
  standard keys use `DASHSCOPE_API_KEY`). The Qwen OAuth free tier was discontinued
  2026-04-15 — do not build on it.
- This harness's installer does NOT touch connection/auth setup; family support is
  detection + injected intelligence only.

## Sources

- [`features/qwen-model-family-support/research/qwen-code-findings.md`](../features/qwen-model-family-support/research/qwen-code-findings.md)
  — official qwen-code facts, cited (prompts.ts, PRs #4505/#5637/#7303/#7661, auth + settings docs).
- [`features/qwen-model-family-support/research/repo-inventory.md`](../features/qwen-model-family-support/research/repo-inventory.md)
  — where detection and injection hook into this repo (hook signatures with file:line).
- [`features/qwen-model-family-support/research/sources/`](../features/qwen-model-family-support/research/sources/)
  — official READMEs (qwen-code, Qwen3-Coder, ZCode) kept as evidence seeds.
