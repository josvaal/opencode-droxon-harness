# Context — pi-todo-questions-grill-me

## Dónde vive "el harness"

El harness es este repo (`opencode-droxon-harness`). Piezas relevantes al pedido:

| Pieza | Ruta | Rol |
|---|---|---|
| Bloque AGENTS.md de Pi | `pi/agents-block.md` | Inyectado en `~/.pi/agent/AGENTS.md` por `install.sh` (marcadores `<!-- droxon-harness:start/end -->`, reemplazo idempotente). **Ya está activo en esta sesión** (contexto del sistema). |
| Instalador Pi | `install.sh` → `install_pi()` (~línea 360-440) | Instala el repo como Pi package + deps best-effort (`pi-subagents`, `pi-mcp-adapter`) + YATT + spec-kit. |
| Skill del orquestador | `pi/skills/droxon-orchestrator/SKILL.md` | Reglas de comunicación/gates del orquestador Pi. |
| Prompt /feature | `pi/prompts/feature.md` (y espejo `command/feature.md` para OpenCode) | Flujo completo de features. |
| Plugin OpenCode | `plugin/droxon-harness.ts` | Inyecta REMINDER en prompts de subagentes (OpenCode). |
| Extensión Pi | `pi/extensions/droxon-harness.ts` | `/droxon-verify` + bloque familia qwen (Pi). |
| Manifiesto package | `package.json` (`"pi": {prompts, skills, extensions}`) | Declara qué carga Pi del package. |
| Docs | `README.md`, `docs/*` | Referencia del harness. |

## Qué ya existe vs qué falta

**Ya existe:**
- `grill-me` instalada globalmente en `~/.agents/skills/grill-me/SKILL.md` (frontmatter: `disable-model-invocation: true`; contenido: 1 línea que delega a "grilling"). NO está embebida en el repo del harness ni referenciada por `pi/agents-block.md`, ni por la skill droxon-orchestrator, ni por `/feature`.
- `install.sh` ya tiene el patrón `pi_install "npm:<pkg>" <desc> best-effort` para deps de Pi.
- Los paquetes existen en npm: `pi-todo@1.2.0` (tool `todo`: add/update/toggle/remove/list/clear/reorder, estado persistente en `.pi/todo.json`, widget TUI) y `pi-questions@0.3.4` (tool `ask_questions`: TUI con opciones + respuesta libre).
- El pedido de lenguaje natural ya aparece como nota de estilo en el brief de un feature previo (`features/qwen-model-family-support/brief.md`) pero NO está codificado en ninguna regla del harness.

**Falta:**
- `install.sh` NO instala `npm:pi-todo` ni `npm:pi-questions`.
- Ninguna regla del harness (agents-block, skill, /feature, REMINDER de subagentes) obliga a usar `ask_questions` para preguntas ni `todo` para tareas pendientes.
- `grill-me` no está vendida dentro del repo (`pi/skills/grill-me/`) ni integrada en el flujo de preguntas del harness.
- La regla de "lenguaje absolutamente natural en todas las preguntas" no existe en el harness.

## Convenciones aplicables (del AGENTS.md de este repo, sección Droxon Harness)

- "What the user named is a hard constraint: implement exactly that" → los nombres `pi-todo`, `pi-questions`, `grill-me` son constraint duro.
- Gates interactivos; nunca commit/push; memoria en MEMORY.md + memory/.
- El repo es dual OpenCode/Pi: los cambios de comportamiento del orquestador viven en `pi/agents-block.md` (Pi) y hay espejos en `agent/*.md`/`command/feature.md` (OpenCode). El pedido dice explícitamente "por lado de pi" para los paquetes y "en general en todo droxon harness" para grill-me y lenguaje natural → aplicará a ambos lados donde sea portable.

## UI / YATT

No aplica: el feature no toca UI ni flujo navegable de producto. Verificación E2E YATT: no aplica.
