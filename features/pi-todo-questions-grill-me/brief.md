# Brief — pi-todo-questions-grill-me

Fecha: 2026-02-13 (sesión actual)

## Pedido original (VERBATIM)

> Para complementar en su totalidad a droxon harness, necesito que por lado de pi incluya los paquetes pi install npm:pi-todo, pi install npm:pi-questions y que el propio harness obligue a usarlos en question en caso de preguntas y en caso de todo para maquetar las tareas pendientes. Ademas quiero que siempre use la skill grill-me eso va en general en todo droxon harness, que esta skill vaya embebido/inyectado en el propio harness npx skills add https://github.com/mattpocock/skills --skill grill-me. Quiero que para todas las preguntas, siempre siempre las responda en lenguaje absolutamente natural (nada de tecnicismos a menos que el usuario lo pida explicitamente)

## Requisitos explícitos extraídos (sin añadir nada)

1. Lado Pi: incluir los paquetes `pi install npm:pi-todo` y `pi install npm:pi-questions`.
2. El harness debe OBLIGAR a usarlos:
   - `pi-questions` (tool `ask_questions`) para toda pregunta al usuario.
   - `pi-todo` (tool `todo`) para maquetar/trackear las tareas pendientes.
3. La skill `grill-me` debe usarse siempre, en general en todo droxon harness.
4. La skill grill-me debe quedar embebida/inyectada en el propio harness (referencia del usuario: `npx skills add https://github.com/mattpocock/skills --skill grill-me`).
5. Para TODAS las preguntas, responder en lenguaje absolutamente natural, nada de tecnicismos salvo que el usuario lo pida explícitamente.

## Nota de estilo (mismo pedido, verbatim)

> usa la skill grill-me para hacerme preguntas para responder, que sean preguntas concisas, detalladas y sobre todo siempre lenguaje natural, nada de tecnicismos. Siempre conciso (mejor calidad que cantidad).

## Decisiones (respuestas GATE 1)

1. **1a** — grill-me se VENDE en el repo (`pi/skills/grill-me/`), Y el harness debe SIEMPRE usarla para el interrogatorio (tal como el pedido original: "quiero que siempre use la skill grill-me eso va en general en todo droxon harness"). Constraint duro.
2. **2b** — solo cambios en el repo; NO instalar hoy en `~/.pi/agent` (C11 queda diferido a la próxima corrida de `install.sh`).
3. **3a** — la obligación de `todo` aplica a cualquier tarea de más de un paso (features, fixes multi-archivo, planes), no solo `/feature`.
4. **4a** — espejo OpenCode actualizado en lo portable (grill-me + lenguaje natural); tools `todo`/`ask_questions` marcadas Pi-only.
5. Caso C11 re-clasificado: ⚠️ diferido (decisión 2b del usuario).
