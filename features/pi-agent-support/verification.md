# Verification — Pi Agent support

Date: 2026-09-23 · Suite: `npm test` → **67 passed / 0 failed** (exit 0) · `bash -n install.sh` OK

## Evidencia por caso

| ID | Caso | Estado | Evidencia |
|---|---|---|---|
| C1 | Menú `(1)/(2)` + EOF/elección inválida | ✅ | T-MENU: 5 asserts (pipe `1`, pipe `2`, EOF→exit≠0, `9`→exit≠0); T-FLAGS: `--target bogus`→exit 2 determinista |
| C2 | No-regresión OpenCode | ✅ | T-OC: árbol completo (agent/, command/, plugins/, tui-plugins/, JSON válidos, default_agent, logo en tui.json); backup `.bak-droxon` con config preexistente (T-FLAGS) |
| C3 | Repo = Pi package válido | ✅ | T-MANIFEST: keyword `pi-package`, manifest `pi` con rutas existentes (python json+glob) |
| C4 | `pi install <repo>` declara el package | ✅ | T-PI-REAL con CLI real: install exit 0, `settings.json` contiene el package, `pi list` lo reconoce (soft-check) |
| C5 | `pi install npm:pi-subagents` (+pi-mcp-adapter) best-effort | ✅ | T-PI-DEPS con `pi` mockeado fallando npm:sources: intenta, avisa, exit 0 |
| C6 | Orquestador en AGENTS.md (merge + backup) | ✅ | T-PI + T-MERGE: bloque `droxon-harness:start/end`, contenido previo preservado, `.bak-droxon` creado solo la primera vez (prístino); symlink → realpath (código, verificado por jueces) |
| C7 | `/feature` Pi adaptado | ✅ | GATE 1/GATE 2/FASE 4 presentes; sin `fastloop_verify`; usa `/droxon-verify` + `pi-subagents`; sin roles sdd-*/jd-judge presentados como instalados (re-judgment ronda 2) |
| C8 | Extensión `/droxon-verify` | ✅ | `bun build --no-bundle` transpila (con guard si no hay bun); firma ExtensionAPI correcta (confirmada por jueces contra docs de Pi) |
| C9 | Deps Pi: YATT+spec-kit sí; fastloop/logo omitidos con aviso | ✅ | T-PI-DEPS: avisos `skipped: opencode-fastloop` y logo; YATT_HOME compartido |
| C10 | Idempotencia | ✅ | T-IDEM: bloque AGENTS.md sin duplicar; árbol OpenCode estable (excluyendo `.bak-droxon` por diseño prístino) |
| C11 | Flags/precedencia | ✅ | `--target bogus` y `DROXON_TARGET=bogus` → exit 2; `--target` gana sobre env |
| C12 | README | ✅ | Secciones "Target 2: Pi Agent", matriz de qué instala cada target, nota de carga in-place (no borrar el clone), uninstall Pi |
| C13 | ZCode notes + mejora | ✅ | `docs/zcode-notes.md` (citas textuales de AGENTS.md/DESIGN.md de zai-org/ZCode); aplicado `npm test` entrypoint en package.json |
| C14 | Degradación sin bun/npm/pi | ✅ | T-DEGRADE (PATH=/usr/bin:/bin): exit 0, archivos instalados, warnings; suite con mocks de curl/uv/git/bun → sin red ni side-effects globales |

## YATT (E2E navegador)

⚠️ No aplica: el feature es un instalador CLI sin UI navegable. La verificación E2E real fue el corredor de instalación con `pi` CLI real en dirs temporales (T-PI-REAL) — más fiel que un navegador aquí.

## Review adversarial dual

- Ronda 1 (jd-judge-a + jd-judge-b ciegos): REQUEST-CHANGES, sin blockers — 4 majors (validación de target, backups prístinos, drift semántico del prompt Pi, symlink/orphan-START) + minors.
- Ronda 2 (misma moneda): A = APPROVE-WITH-NITPICKS; B = REQUEST-CHANGES por 1 remanente (GATE 2 citaba jd-judge-a/b) + warnings (orphan-START data-loss, red en tests).
- Fix acotado ronda 2: remanente eliminado (hoy `jd-judge` en pi/ aparece solo en la nota aclaratoria de que NO están instalados), orphan-START conserva todo contenido de usuario (verificado: contenido tras START huérfano sobrevive), tests con curl/uv mockeados (cero red/global installs), guard de bun en assert de transpile.
- Presupuesto de rondas agotado (2/2); estado final 67/67 verde.

## Cómo reproducir

```bash
npm test                       # suite completa (dirs temporales, sin tocar tu config)
./install.sh                   # menú (1) OpenCode (2) Pi Agent
./install.sh --target pi       # no interactivo
```
