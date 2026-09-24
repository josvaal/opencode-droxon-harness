# Plan — Pi Agent support

Tareas ordenadas. Cada tarea: casos que cubre + test que la demuestra.

## T1 — Suite de tests del instalador (base RED→GREEN)
Crear `tests/test-install.sh` (bash puro, sin framework): helpers de dirs temporales, mock de `pi` CLI, corridas de `./install.sh` con `OPENCODE_CONFIG_DIR`/`PI_CODING_AGENT_DIR` temporales.
- Cubre: C1, C2, C10, C11 (infra)
- Test: `tests/test-install.sh` (es el propio harness de verificación; cada caso registra asserts con salida `ok/FAIL`)

## T2 — CLI del instalador: `--target opencode|pi`, env `DROXON_TARGET`, menú interactivo `(1)/(2)`
Refactor de `install.sh`: `main` con parse de flags, `select_target`, dispatch a `install_opencode` / `install_pi`. `install_opencode` = contenido actual intacto.
- Cubre: C1, C2, C11
- Test: T1 (casos menú, flags, no-regresión)

## T3 — Pi package: manifest + recursos
- `package.json`: agregar `"keywords": [... "pi-package"]` y `"pi": {"prompts": ["pi/prompts/*.md"], "skills": ["pi/skills/*"], "extensions": ["pi/extensions/*.ts"]}`.
- `pi/prompts/feature.md`: adaptación de `command/feature.md` (equivalentes Pi).
- `pi/skills/droxon-orchestrator/SKILL.md`: núcleo del orquestador como skill Pi.
- Cubre: C3, C7
- Test: T1 (validación de manifest + grep de gates en feature.md)

## T4 — `install_pi()` en install.sh
- Verificar/instalar `pi` CLI (npm i -g si falta, best-effort), `bun` (reuso `ensure_bun`).
- `pi install "$SRC"` (package local), `pi install npm:pi-subagents` (best-effort), sugerencia de `npm:pi-mcp-adapter` para YATT.
- Merge de bloque droxon en `~/.pi/agent/AGENTS.md` (python heredoc idempotente + backup `.bak-droxon`).
- Reuso `ensure_yatt` + `ensure_speckit`; fastloop y logo omitidos con aviso.
- Cubre: C4, C5, C6, C9
- Test: T1 (con mock de `pi` cuando el CLI real no esté; `pi install` real si existe en el entorno)

## T5 — Extensión Pi `pi/extensions/droxon-harness.ts`
`ExtensionAPI`: comando `/droxon-verify` que detecta y corre el typecheck/build del proyecto (package.json scripts → tsc fallback) y notifica resultado. Sin procesos en el factory (contrato Pi).
- Cubre: C8
- Test: T1 (chequeo de sintaxis con bun) + smoke: `pi -e` si hay CLI

## T6 — Idempotencia y degradación
Ajustes que revelen los tests de doble corrida y PATH recortado; warnings para ausencia de bun/npm/pi.
- Cubre: C10, C14
- Test: T1

## T7 — Retroalimentación ZCode
Estudio del repo zai-org/ZCode (README.en, DESIGN.md, AGENTS.md, NOTICE) → `docs/zcode-notes.md` con hallazgos accionables; aplicar 1–2 mejoras de bajo riesgo al harness (candidato: cláusula de arquitectura/policy inspirada, o mejoras de robustez del instalador ya cubiertas).
- Cubre: C13
- Test: revisión del doc + diff acotado

## T8 — README
Sección "Install for Pi Agent": menú/flags, qué instala cada target, matriz de portabilidad, limitaciones (fastloop, logo), comandos `pi` equivalentes.
- Cubre: C12
- Test: revisión directa

## T9 — GATE 2: suite completa + verificación
`tests/test-install.sh` completo verde, `bash -n install.sh`, summary de casos con Estado final.
- Cubre: todos
- Test: suite completa
