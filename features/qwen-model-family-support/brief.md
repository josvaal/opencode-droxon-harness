# Brief — Qwen model-family support for droxon-harness

Date: 2026-09-25

## Pedido original (VERBATIM)

> Como te darás cuenta, el agente droxon solo tiene compatibilidad con los modelos de la familia GLM, pero quisiera que tambien lo tenga con la familia Qwen, y que mejor que el agente harness oficial qwen code https://github.com/qwenLM/qwen-code para que lo implementes a droxon harness la capacidad, como por ejemplo, cada vez que se haga un prompt (ya sea con pi u opencode) el agente primero detecte si el modelo que usa es glm o qwen y llame al harness o inteligencia correspondiente segun su familia de modelo (Qwen o GLM).

(Nota del usuario, estilo de interacción:) usa la skill grill-me para hacerme preguntas para responder, que sean preguntas concisas, detalladas y sobre todo siempre lenguaje natural, nada de tecnicismos. Siempre conciso (mejor calidad que cantidad).

## Requisitos explícitos extraídos

1. droxon hoy solo es compatible con la familia de modelos **GLM**; debe soportar también la familia **Qwen**.
2. Referencia de implementación: el harness oficial de Qwen, **qwen-code** (https://github.com/qwenLM/qwen-code) — es la fuente preferida para saber qué significa "inteligencia Qwen".
3. En **cada prompt** (tanto en **Pi** como en **OpenCode**), el agente **primero detecta** si el modelo en uso es de familia **GLM o Qwen**.
4. Según la familia detectada, se usa el **harness o inteligencia correspondiente** (comportamiento/prompts afines a Qwen o a GLM).

## Decisiones (GATE 1 — 2026-09-25)

Respuestas del usuario: **1a, 2b, 3a, 4a**.

1. **Alcance de la inteligencia Qwen (1a)**: bloque de conducta propio + ejemplos de uso de herramientas al estilo qwen-code, **destilados a nuestro formato** (lo esencial, no el calco). Se materializa como un bloque inyectado por prompt cuando la familia detectada es Qwen.
2. **Familias desconocidas (2b)**: trato de siempre — GLM/unknown **no reciben bloque inyectado**; el harness estático actual (que ya es el trato GLM) queda intacto. **La inyección ocurre SOLO con familia Qwen detectada.** Regresión cero para GLM y desconocidos.
3. **Instalador (3a)**: la configuración de conexión (endpoints/claves de Alibaba) queda **fuera de alcance**. La feature es detección + inteligencia; install.sh solo cambia lo mínimo que exija el mecanismo (p.ej. copiar el módulo compartido).
4. **Anuncio (4a)**: detección **silenciosa**; verificable a demanda vía docs y specs, sin avisos en la sesión.
