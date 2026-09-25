# Plan — Qwen model-family support

Date: 2026-09-25
Decisiones GATE 1: **1a, 2b, 3a, 4a** → ver `brief.md > Decisiones`. Síntesis: inyección SOLO para familia Qwen; destilado (no calco); instalador fuera de conexión; silencioso.

## Decisiones de diseño (derivadas de la evidencia de `research/repo-inventory.md`)

- **Un solo módulo de verdad**: `plugin/model-family.ts` (detección + bloques destilados). El plugin OpenCode importa `"./model-family.ts"` (funciona idéntico en repo y en `~/.config/opencode/plugins/` — el instalador copia ambos); la extensión Pi importa `"../../plugin/model-family.ts"` (Pi carga el paquete in-place). Nada duplicado.
- **OpenCode**: `chat.message` captura la familia por `sessionID`; `experimental.chat.system.transform` appendea el bloque Qwen a `output.system` cuando la familia es qwen (hook experimental → degradación elegante si no existe); `tool.execute.before` (task) añade la nota Qwen al contrato de subagente solo en sesiones qwen.
- **Pi**: `pi.on("before_agent_start", (_event, ctx) => ...)` con familia desde `ctx.model`; si qwen → `return { systemPrompt: _event.systemPrompt + "\n\n" + bloque }` (patrón oficial `examples/extensions/pirate.ts`; `BeforeAgentStartEventResult.systemPrompt`). GLM/unknown → `return undefined` (regresión cero).
- **Stateless por prompt** (C6): la familia se resuelve del modelo del request/session actual, nunca de un estado global del proceso (el mapa por sessionID del plugin se recalcula en cada `chat.message`).

## Tareas

**T1 — Módulo de familia (`plugin/model-family.ts`, nuevo)**
- Cubre: C7, C4, C6
- `detectModelFamily({modelID?, providerID?, baseUrl?}) → "glm"|"qwen"|"unknown"`: señal modelID primero (qwen: `/qwen/i`; glm: `/glm/i`), luego endpoint (qwen: `dashscope|maas|aliyuncs`; glm: `z.ai`); case-insensitive.
- `resolveFamily(f) → "glm"|"qwen"` (unknown→glm, decisión 2b).
- `familyIntelBlock("glm"|"qwen") → string`: bloque destilado 1a — GLM: notas actuales (razonamiento oculto → mensaje final, orden cache-friendly); Qwen: conducta + sintaxis tool-call qwen-coder (`<tool_call><function=…><parameter=…>`), razonamiento según tier, ~1M in/64K out, no forzar tool_choice con thinking activo, puntero a docs.
- Test: `tests/family.spec.ts` (T2).

**T2 — Specs + runner (`tests/family.spec.ts`, `tests/test-family.sh`, `package.json`)**
- Cubre: C7, C4, C6, C9
- Spec bun:test con la tabla C7 (glm-5.3-flash→glm; qwen3-coder-plus/qwen3.6-plus/qwen3-coder-next→qwen; kimi-k2.5/deepseek/GPT→unknown; "GLM-5" mayúsculas→glm; glm-5+dashscope→glm por prioridad del modelID; endpoint-only dashscope/coding-intl→qwen), resolveFamily(unknown)→glm, contenido de bloques, statelessness.
- Runner bash estilo house (skip sin bun, como T-PI) + aserciones fuente: plugin contiene `chat.message` y `experimental.chat.system.transform`; extensión contiene `before_agent_start`; `docs/qwen-notes.md` existe; keyword `"qwen"` en package.json; instalador copia `model-family.ts`.
- `npm test` = `test-install.sh && test-family.sh`.
- Test: `bash tests/test-family.sh` verde.

**T3 — Plugin OpenCode (`plugin/droxon-harness.ts`)**
- Cubre: C1, C5, C6
- Hook `chat.message`: `detectModelFamily({modelID: input.model?.modelID, providerID: input.model?.providerID})` → mapa `Map<sessionID, family>`.
- Hook `experimental.chat.system.transform`: si familia del input.model es qwen → `output.system.push(familyIntelBlock("qwen"))` (cada transform es fresco; idempotente por request). Si el hook no existe en la versión instalada → simplemente no se llama (degradación elegante, documentada).
- `tool.execute.before` (task): contrato actual intacto para glm/unknown (2b); en sesión qwen, appendea nota Qwen de subagente (C5): mensaje final completo + sintaxis tool-call qwen-coder.
- Test: aserciones fuente de T2 + transpile.

**T4 — Extensión Pi (`pi/extensions/droxon-harness.ts`)**
- Cubre: C2, C6
- `pi.on("before_agent_start")`: familia desde `ctx.model` (campos exactos a verificar en types.d.ts: `id`, `provider`, `baseUrl`); qwen → inyectar bloque; resto → `undefined` (hoy intacto). `/droxon-verify` sin cambios.
- Test: aserción fuente de T2 + transpile.

**T5 — Prosa del orquestador (`agent/droxon-agent.md`)**
- Cubre: C3, C8
- L2 "GLM-family friendly" → "GLM & Qwen family friendly"; L28 identidad → familia detectada por prompt (GLM o Qwen); L256 → "Models may emit reasoning…" (neutro); L262 → "GLM and Qwen families". Conducta intacta.
- Test: grep de T2 (sin identidad exclusiva GLM) + suite.

**T6 — Docs (`docs/qwen-notes.md` nuevo; `docs/harness.md`; `README.md`; `package.json`)**
- Cubre: C8
- `qwen-notes.md`: destilado oficial (detección por nombre/endpoint, tiers y thinking, formato tool-call, límites ~1M/64K, auth ModelStudio — OAuth muerto 2026-04-15) citando `features/qwen-model-family-support/research/`. `harness.md`: título/§5 → "GLM & Qwen families" + subsección Qwen. README L8-9 → familias GLM y Qwen con detección por prompt. package.json: description + keyword "qwen".
- Test: greps de T2.

**T7 — Gates de build + suite completa**
- Cubre: C9, C3
- Transpile de los 3 TS (`bun build --no-bundle` plugin, extensión, model-family). Suite completa `npm test` (instalación temp dirs, menú/flags, idempotencia T-IDEM, merge T-MERGE, degradación T-DEGRADE + family). GLM regression: los tests existentes en verde SIN cambios (C3).
- Test: `npm test` → N passed / 0 failed.

**T8 — ⛔ GATE 2: cierre**
- Cubre: todos
- `verification.md` (tabla por caso con evidencia), revisión adversarial dual (2 jueces ciegos; diff estimado >400 líneas), estados finales de `cases.md`, memoria del repo (`memory/` + `MEMORY.md`).

## Regla de cobertura

Todo caso (C1-C9) tiene ≥1 tarea y ≥1 test nombrado. Sin excepciones.
