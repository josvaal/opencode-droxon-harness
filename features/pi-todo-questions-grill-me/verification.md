# Verification — pi-todo-questions-grill-me

## Gate real del repo

`npm test` → **verde**: test-install.sh 69 passed / 0 failed + test-family.sh 9 passed / 0 failed (`bash -n install.sh` OK). Este repo no tiene script de build/typecheck: la suite bash+bun es su gate real. YATT: no aplica (sin UI ni flujo navegable). Review adversarial: no aplica (diff < ~400 líneas, bajo riesgo).

| Caso | Estado | Evidencia |
|---|---|---|
| C1 pi-todo en install.sh | ✅ | `install.sh` `install_pi()`: `pi_install "npm:pi-todo" "pi-todo" best-effort` + resumen final; script verificado con `bash -n` y suite verde. Run real diferido (C11) |
| C2 pi-questions en install.sh | ✅ | Ídem con `npm:pi-questions` |
| C3 grill-me embebida | ✅ | `pi/skills/grill-me/SKILL.md` (frontmatter idéntico al original de mattpocock/skills + nota de procedencia); expuesta por `package.json` `"pi".skills` glob y por el fallback manual de install.sh (copia `pi/skills/*/`) |
| C4 ask_questions obligatorio | ✅ | `pi/agents-block.md` nueva sección "Questions, todos & language (hard rules)" — regla 1 |
| C5 todo obligatorio | ✅ | Misma sección — regla 2 (toda tarea de >1 paso) |
| C6 grill-me siempre | ✅ | Misma sección regla 3 + `pi/skills/droxon-orchestrator/SKILL.md` (sección "Questions, todos & language") |
| C7 /feature espejado | ✅ | `pi/prompts/feature.md` GATE 1 + FASE 3; `command/feature.md` con lo portable (ask_questions/todo marcados Pi-only, lenguaje natural universal) |
| C8 subagentes | ✅ | `plugin/droxon-harness.ts` REMINDER: línea nueva con ask_questions/lenguaje natural/todo/grill-me |
| C9 idempotencia merge | ✅ | El repo-file no lleva marcadores (los añade el installer); bloque nuevo es una sección simple dentro del bloque → el reemplazo START/END sigue siendo exacto. `bash -n` OK |
| C10 suite verde | ✅ | `npm test`: 69 + 9 passed, 0 failed |
| C11 instalación real hoy | ⚠️ diferido | Decisión 2b del usuario (GATE 1): solo repo. Se aplica ejecutando `./install.sh --target pi` (o manualmente: `pi install npm:pi-todo && pi install npm:pi-questions` + re-corrida del installer para re-mergear AGENTS.md) |

## Cómo reproducir

```bash
cd opencode-droxon-harness
npm test                      # suite completa en verde
bash -n install.sh            # sintaxis del instalador
grep -n "pi-todo\|pi-questions" install.sh
grep -n "ask_questions" pi/agents-block.md
./install.sh --target pi      # (cuando el usuario quiera) aplica todo en ~/.pi/agent
```

## Post-entrega (feedback del usuario): dedupe de grill-me

Pi reportó colisión: la copia personal `~/.agents/skills/grill-me` ganaba sobre
la vendida en el package. Fix pedido por el usuario: el instalador verifica si
ya existe grill-me y solo instala la copia vendida si no hay ninguna.

- `pi/skills/grill-me/` → `vendor-skills/grill-me/` (fuera del manifest del
  package, Pi ya no la auto-carga → sin colisión).
- `install.sh` (ambos caminos: pi install y fallback manual): si existe
  `$PI_DIR/skills/grill-me` o `~/.agents/skills/grill-me`, se salta con aviso
  "no duplication"; si no, copia la vendida.
- Re-verificado: `bash -n` OK + `npm test` 78 passed / 0 failed.
