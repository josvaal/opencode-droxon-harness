# Plan — pi-todo-questions-grill-me

Tareas ordenadas. Cobertura: todos los casos activos (C1–C10); C11 ⚠️ diferido (decisión 2b).

| # | Tarea | Cubre | Test |
|---|---|---|---|
| T1 | Vender skill grill-me: crear `pi/skills/grill-me/SKILL.md` (contenido de mattpocock/skills, la copia local ya instalada en `~/.agents/skills/grill-me/`) | C3 | readback: el archivo existe y el glob `pi/skills/*` de `package.json` lo expone |
| T2 | `pi/agents-block.md`: añadir sección "Questions, todos & language" con reglas duras — (a) TODA pregunta al usuario va por `ask_questions` (pi-questions), (b) toda tarea de >1 paso se maqueta con `todo` (pi-todo), (c) el interrogatorio de sharpening SIEMPRE vía skill grill-me, (d) TODAS las preguntas en lenguaje absolutamente natural, cero tecnicismos salvo pedido explícito | C4, C5, C6 | readback + grep de las 4 reglas en el bloque |
| T3 | `pi/skills/droxon-orchestrator/SKILL.md`: sección Communication reforzada con las mismas 4 obligaciones (cross-ref a grill-me) | C6 | readback |
| T4 | `pi/prompts/feature.md`: GATE 1 pide preguntas vía `ask_questions` con lenguaje natural y grill-me; FASE 3/4 maquetan tareas con `todo`. Espejo `command/feature.md` con lo portable (grill-me + lenguaje natural; tools Pi-only anotadas) | C7 | readback de ambos archivos |
| T5 | `install.sh`: añadir `pi_install "npm:pi-todo"` y `pi_install "npm:pi-questions"` en `install_pi()` deps + resumen final | C1, C2 | bash bash -n + `tests/test-install.sh` |
| T6 | `plugin/droxon-harness.ts` REMINDER: añadir línea de lenguaje natural para preguntas al usuario (portable OpenCode) | C8 | grep del REMINDER + `tests/test-family.sh` |
| T7 | Verificación final: `npm test` completo; re-chequeo de cases.md (estados) | C9, C10 | `npm test` verde |

Notas:
- No se ejecuta `pi install` en la máquina del usuario (decisión 2b); la verificación de C1/C2 es a nivel script (bash -n + suite del repo). La prueba real quedará en la próxima corrida de `install.sh`.
- C9 se verifica con la mecánica de merge existente: el bloque nuevo conserva marcadores START/END, así que el reemplazo idempotente no cambia.
