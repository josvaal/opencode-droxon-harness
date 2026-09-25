# Contexto — Qwen model-family support

Date: 2026-09-25

## Inventario del repo (piezas relevantes)

| Pieza | Archivo | Rol en el feature |
|---|---|---|
| Agente orquestador | `agent/droxon-agent.md` | Identidad GLM en 4 puntos (L2, L28, L256, L262). **L256 es la única dependencia conductual real** ("GLM emits reasoning the user never sees…") |
| Plugin OpenCode | `plugin/droxon-harness.ts` | Único hook hoy: `tool.execute.before` filtrado a `task` (L25-32) — appendea contrato a subagentes |
| Extensión Pi | `pi/extensions/droxon-harness.ts` | Solo registra `/droxon-verify`; sin hooks de prompt todavía |
| Instalador | `install.sh` | OpenCode: copia files + heredocs python idempotentes sobre `opencode.json`/`tui.json`; **nunca escribe clave `model`** (L216-240). Pi: `pi install` + merge AGENTS.md con backups `.bak-droxon` |
| Tests | `tests/test-install.sh` | **0 aserciones GLM** (grep verificado). Riesgo de rotura: solo T-MANIFEST (keywords de package.json) — cambios aditivos seguros |
| Docs de diseño | `docs/harness.md` | §5 "GLM family compatibility" (L174-204); convención "per-model knobs live in config" (L189-191); GLM notes (L165-168) |
| Docs núcleo | `docs/harness-core.md` | Destilado de ZCode/GLM (L3, L309, L328-330) — **precedente exacto** del destilado qwen-code que hay que hacer |
| Empaquetado | `package.json` | description + keyword `glm` (L4, L39) |
| README | `README.md:8-9` | "Model-agnostic for the **GLM family**" |

## Dónde está el acople a GLM hoy (verificado por scout, `research/repo-inventory.md`)

- **Conductual (2 puntos en todo el repo)**: `agent/droxon-agent.md:256` y `docs/harness.md:165-168` — ambos asumen "GLM emite razonamiento oculto; el mensaje final lo carga todo".
- **Cero menciones GLM** en: los 13 subagentes (`agent/sdd-*.md`, `jd-judge-*`), `command/feature.md`, `pi/prompts/feature.md`, `pi/skills/droxon-orchestrator/SKILL.md`, `pi/agents-block.md`, `install.sh`, `plugin/droxon-harness.ts`, `pi/extensions/droxon-harness.ts`, `tests/test-install.sh`, `memory/*.md`.
- El harness ya declara la convención: "Model-agnostic: never hardcode a model version; per-model knobs live in config" (`agent/droxon-agent.md:262`, `docs/harness.md:189-191`).

## Mecánica de detección/interceptación — OpenCode (verificado contra tipos instalados en esta máquina)

Tipos en `~/.config/opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts` (existen; citas en `research/repo-inventory.md` §2):

- `chat.message` — dispara **por cada mensaje de usuario**; input trae `model?: { providerID, modelID }` → punto exacto de **detección por prompt**.
- `experimental.chat.system.transform` — input `{ sessionID?, model }`, output `{ system: string[] }` → canal para **inyectar la inteligencia de familia** en el system prompt. Es hook experimental: riesgo de drift entre versiones de OpenCode (mitigar con degradación elegante).
- `chat.params` — input con `model` completo; permite knobs de generación por familia.
- `tool.execute.before` (el actual) — NO expone modelo; sirve para el contrato de subagentes usando la familia capturada por `chat.message` (keyed por `sessionID`).
- Config viva: `~/.config/opencode/opencode.json` tiene `default_agent: "droxon-agent"`, **sin** clave `model` top-level (el modelo lo elige el usuario en la app).

## Mecánica de detección/interceptación — Pi (verificado contra docs + tipos instalados)

Docs: `.../pi-coding-agent/docs/extensions.md`; tipos: `.../dist/core/extensions/types.d.ts` (citas en `research/repo-inventory.md` §3):

- `before_agent_start` — "Fired after user submits prompt but before agent loop": trae `prompt`, `systemPrompt` (readonly) y `systemPromptOptions` **mutable**; devolver `systemPrompt` o `forceSystemPrompt` reemplaza el prompt de ese run (extensions.md:101) → punto exacto de **detección+inyección por prompt**.
- Modelo actual: `ctx.model` / `ctx.getModel()` (types.d.ts:223-224, 1348); evento `model_select` al cambiar de modelo (types.d.ts:697-703).
- `pi.sendMessage(message)` — contenido que SÍ llega al modelo (types.d.ts:1046) — canal alternativo.
- `SYSTEM.md`/`APPEND_SYSTEM.md` — estáticos, no por-prompt → no aplican.

## Qué significa "inteligencia Qwen" (qwen-code — ver `research/qwen-code-findings.md`)

1. **Detección por nombre/endpoint**: regex sobre el ID del modelo (`/qwen[^-]*-coder/i`, `/qwen[^-]*-vl/i`, etc.) elige ejemplos de tool-calls distintos en el system prompt; contexto inferido por nombre; endpoints DashScope/ModelStudio como señal (fuente oficial: `packages/core/src/core/prompts.ts`).
2. **Conducta Qwen3-Coder**: los open-weight NO emiten thinking; los plus/max hosted SÍ (knob `enable_thinking`); `tool_choice: "required"` se rechaza con thinking activo; contexto ~1M, salida ~65K.
3. **Qwen OAuth free tier: discontinuado 2026-04-15** — hoy solo ModelStudio/API keys.
4. **ZCode (GLM) no documenta adaptación pública** — nuestro `docs/harness-core.md` YA es la inteligencia GLM destilada; el trabajo Qwen es el destilado equivalente de qwen-code.

## Qué ya existe vs qué falta

- **Ya existe**: arquitectura agnóstica dentro de GLM (knobs en config), contrato de subagentes vía hook (OpenCode), `/droxon-verify` (Pi), suite de instalación con idempotencia y backups.
- **No existe**: detección de familia, bloque de inteligencia por familia, conocimiento Qwen en docs, README/package.json actualizados (dicen "GLM only").

## Convenciones aplicables

- "Per-model knobs live in config, never in harness prose" (`docs/harness.md:189-191`, `agent/droxon-agent.md:262`) — la tabla de detección es configuración/datos, no prosa.
- Instalador idempotente, backups `.bak-droxon` (tests T-IDEM, T-MERGE lo exigen).
- Estilo de artefactos = house style de `features/pi-agent-support/` (resumido en `research/repo-inventory.md` §6).
- ⚠️ **YATT no aplica**: el feature no toca UI navegable (harness de agentes CLI). La verificación es: specs de la lógica de familia + suite `npm test` + smoke documentado.

## Investigación consolidada

- `research/repo-inventory.md` — inventario completo del repo con file:line (scout).
- `research/qwen-code-findings.md` — hallazgos oficiales de qwen-code/ZCode con fuentes (researcher).
- `research/sources/` — READMEs oficiales + árbol git de qwen-code (semillas verificadas).
