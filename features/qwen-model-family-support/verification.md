# Verificación — Qwen model-family support

Date: 2026-09-25
Suite: `npm test` → test-install.sh **69 passed / 0 failed** + test-family.sh **9 passed / 0 failed** · `bun test tests/family.spec.ts` → **30 passed / 0 failed** · transpilación `bun build --no-bundle` de los 3 TS → **exit 0**.

## Evidencia por caso

| ID | Caso | Estado | Evidencia |
|---|---|---|---|
| C1 | Prompt en OpenCode con modelo Qwen | ✅ implementado + test verde | Specs hook-level en `tests/family.spec.ts` (chat.message→nota, transform inyecta bloque único re-run-safe, upgrade por endpoint); asserts fuente en `tests/test-family.sh` (hooks presentes en el plugin instalado) |
| C2 | Prompt en Pi con modelo Qwen | ✅ implementado + test verde | Specs del handler `before_agent_start` (qwen → `BASE\n\n<bloque>`); assert fuente `before_agent_start` en la extensión |
| C3 | GLM sin regresión (byte-identidad) | ✅ implementado + test verde | Specs: `glmPrompt === unknownPrompt` byte-iguales; transform glm → `system` intacto (`toEqual(["base"])`); Pi glm/unknown/undefined → `undefined`; suite preexistente 69/69 SIN modificaciones (solo asserts nuevos) |
| C4 | Otra familia → trato de siempre (2b) | ✅ implementado + test verde | Spec `resolveFamily("unknown") === "glm"` + byte-identidad unknown en hooks |
| C5 | Contrato de subagentes por familia | ✅ implementado + test verde | Nota solo en sesiones qwen (spec); sintaxis XML **acotada a qwen-coder** tras la ronda de fix (descriptiva, alineada al gate upstream `/qwen[^-]*-coder/i`) |
| C6 | Cambio de modelo en vuelo | ✅ implementado + test verde | Detección stateless por prompt; spec de no-flip (mensaje sin modelo NO pisa la familia detectada) |
| C7 | Detección robusta ID+endpoint | ✅ implementado + test verde | Tabla de 15+ casos en specs: glm-5.3-flash, qwen3-coder-plus/next, qwen3.6-plus, GLM-5 mayúsculas, glm-5+dashscope (modelID gana), endpoint-only dashscope/coding-intl, kimi/deepseek/GPT → unknown |
| C8 | Veracidad documental | ✅ implementado + test verde | `docs/qwen-notes.md` (nuevo, con fuentes); `docs/harness.md` §5 "GLM & Qwen"; README L8-9 dual-family; `agent/droxon-agent.md` identidad neutral (L2/L28/L256/L262); package.json keyword `qwen` + description; greps en suite |
| C9 | Instalador sin regresión | ✅ implementado + test verde | `npm test` completo en verde; asserts nuevos de árbol: `lib/model-family.ts` presente, `plugins/model-family.ts` ausente (no auto-cargada), fallback Pi con módulo en raíz del agent-dir; T-IDEM/T-MERGE/T-DEGRADE intactos |

## YATT (E2E navegador)

**No aplica**: el feature no toca UI ni flujo navegable (harness de agentes CLI/extensiones). El equivalente de punta a punta en este dominio son los specs de wiring a nivel de hooks (30 specs que ejecutan el plugin y la extensión reales con mocks tipados) + la suite de instalación en temp dirs. Nunca se simuló un E2E que no existe.

## Build gate real

`package.json` no tiene script typecheck/build (preexistente). Gate aplicado, consistente con el estándar del repo (T-PI ya transpilaba la extensión): `bun build --no-bundle` de `plugin/droxon-harness.ts`, `pi/extensions/droxon-harness.ts` y `plugin/model-family.ts` → exit 0, más la suite completa.

## Review adversarial dual (diff >400 líneas → obligatoria)

- **Juez A: APPROVE** — 6 hallazgos menores/nits; verificó reglas-cero mecánicamente contra SDK types instalados.
- **Juez B: REQUEST_CHANGES** — 1 mayor (fallback Pi sin CLI rompía la carga de la extensión por el import estático) + 5 menores (guard model-less, cap del mapa, asimetría de señal transform/chat.message, sintaxis XML sin acotar, 2 huecos de test).
- **Convergencia independiente**: ambos hallaron el problema del fallback Pi → señal fuerte de hallazgo real.
- **Ronda de fix única (aplicada)**: cascada de import dinámico en ambos consumidores resolviendo los **4 layouts** (in-repo, Pi in-place, OpenCode instalado `lib/`, Pi fallback raíz); guard `input.model` en chat.message; cap 500 con evicción FIFO; el transform también registra la familia (señal completa con endpoint) con guard de no-señal; sintaxis XML descriptiva y acotada a qwen-coder; +7 specs hook-level; +2 asserts de árbol instalado; log del instalador. Módulo movido a `lib/` (fuera del auto-load de plugins/).
- **Re-juzgamiento: APPROVE** — "los 7 hallazgos genuinamente resueltos (verificados contra fuente)", sin bugs nuevos, specs no vacuos (conteo 30 exacto). Dejó 2 notas P2 **no bloqueantes** report-only: (1) el assert del módulo en fallback solo corre sin pi CLI en la máquina; (2) evicción FIFO no LRU — falla segura (nota ausente, nunca familia equivocada).

## Cómo reproducir

```bash
cd /home/codicore/droxon-harness
bun test tests/family.spec.ts        # 30 specs: detección (tabla) + wiring plugin/Pi
bash tests/test-family.sh            # 9 asserts: specs + fuente (hooks, docs, keyword)
npm test                             # suite completa: instalación temp dirs (69) + family (9)
bun build --no-bundle plugin/droxon-harness.ts pi/extensions/droxon-harness.ts plugin/model-family.ts
```
