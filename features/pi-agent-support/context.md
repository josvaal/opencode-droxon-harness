# Context — Pi Agent support

Date: 2026-09-23

## Inventario del repo (droxon-harness)

| Pieza | Archivo | Acoplada a OpenCode |
|---|---|---|
| Orchestrator agent | `agent/droxon-agent.md` | Sí — asume `task` tool con subagentes, `fastloop_verify`, gates ⛔ en turnos |
| Subagentes SDD | `agent/sdd-*.md` (11) | Sí — son *agent definitions* de OpenCode (frontmatter de subagentes) |
| Jueces adversariales | `agent/jd-judge-{a,b}.md` | Sí — idem |
| Comando /feature | `command/feature.md` | Sí — comando slash de OpenCode |
| Plugin hook | `plugin/droxon-harness.ts` | Sí — API `@opencode-ai/plugin` (`tool.execute.before` sobre tool `task`) |
| Logo TUI | `tui/droxon-logo.tsx` | Sí — componente TUI de OpenCode (`tui.json`) |
| Instalador | `install.sh` | Copia a `~/.config/opencode` + registra deps en `opencode.json`/`tui.json` |
| Deps: fastloop | plugin npm `opencode-fastloop/server` | Exclusivo de OpenCode |
| Deps: YATT | MCP server registrado en `opencode.json mcp` | Registro OpenCode; el server en sí es un proceso bun genérico |
| Deps: spec-kit | CLI `specify` (uv) | Agnóstico — sirve igual en Pi |

No hay AGENTS.md en este repo; convenciones de estilo del instalador: bash con `set -euo pipefail`, helpers `log`/`warn`, mutaciones de JSON vía `python3` heredoc idempotentes, backups `.bak-droxon`, override por env var (`OPENCODE_CONFIG_DIR`, `YATT_HOME`, `DROXON_SKIP_DEPS`).

## Qué es Pi Agent (verificado en earendil-works/pi, docs oficiales)

- Agent dir: `~/.pi/agent` (override `PI_CODING_AGENT_DIR`). Estructura:
  - `settings.json`, `AGENTS.md` (instrucciones de usuario cross-proyecto), `SYSTEM.md` / `APPEND_SYSTEM.md` (reemplazan/extenden el system prompt).
  - `extensions/` — TypeScript con `jiti` (sin build), factory `export default function (pi: ExtensionAPI)`.
  - `skills/` — skills estilo SKILL.md.
  - `prompts/` — **prompt templates expuestos como slash commands** → aquí mapea `/feature`.
  - `themes/` — temas; **no hay logo personalizable** (el logo de OpenCode no es portable).
- Extensiones: eventos (`before_agent_start`, `tool_call`, `tool_result`...), `pi.registerCommand()`, `pi.registerTool()`. **No existe tool `task`/subagentes nativos ni registro de "agents"**.
- **No tiene soporte MCP nativo** (filosofía: extensiones). `settings.json` tiene `mcp` servers? — NO verificado; docs de configuración no lo mencionan → asumir que no.
- fastloop (`fastloop_verify`) es un plugin npm de OpenCode → no portable tal cual.

## Mapa de portabilidad

| Pieza droxon | Destino en Pi | Nota |
|---|---|---|
| `droxon-agent.md` | `~/.pi/agent/AGENTS.md` (merge si existe) o `APPEND_SYSTEM.md` | El rol de orquestador viaja como instrucciones |
| `sdd-*.md` + `jd-judge-*` | `~/.pi/agent/skills/<nombre>/SKILL.md` (adaptando frontmatter) | En Pi no hay subagentes; se usan como skills/instrucciones de fase |
| `/feature` | `~/.pi/agent/prompts/feature.md` | Slash command nativo de Pi |
| plugin hook | `~/.pi/agent/extensions/droxon-harness.ts` (reescrito a `ExtensionAPI`) | El contrato de subagentes no aplica igual (no hay `task`); el análogo: inyectar el contrato en `before_agent_start` o documentarlo en AGENTS.md |
| logo TUI | ❌ sin equivalente | No portable |
| YATT | clonar + `bun install` igual; sin registro MCP | El harness degrada gracefully si no hay yatt_ping |
| spec-kit | igual (CLI global) | Portable tal cual |
| fastloop | ❌ exclusivo OpenCode | En Pi la verificación queda a cargo de tests + bash del agente |

## ZCode (zai-org/ZCode, Apache-2.0, liberado 2026)

Workbench completo (desktop Electron + web + CLI `zcode` con TUI). Útil como fuente de ideas, no como dependencia. Requisito 4 del brief es abierto → requiere decisión del usuario en GATE 1.

## Descubrimientos de exploración (código)

- `install.sh` ya centraliza todo en funciones (`install_harness`, `ensure_fastloop`, `ensure_yatt`, `ensure_speckit`) → insertar un selector de target es natural.
- Los `sdd-*.md` del repo tienen frontmatter de OpenCode (`description`, `mode: subagent`?) — verificado visualmente en `plugin/` y `agent/`; la conversión a SKILL.md necesita reescribir el frontmatter a `name`+`description`.
- `install.sh` asume `DEST` único; con dos targets conviene parametrizar por-target (funciones de instalación separadas `install_opencode` / `install_pi`).
