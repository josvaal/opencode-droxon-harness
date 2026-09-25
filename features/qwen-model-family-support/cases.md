# Casos — Qwen model-family support

Date: 2026-09-25
GATE 1: **resuelto 2026-09-25 — 1a, 2b, 3a, 4a** (detalle en `brief.md > Decisiones`). Consecuencia directa: la inyección de bloque ocurre SOLO cuando la familia detectada es Qwen; GLM y desconocidos conservan el comportamiento actual exacto (2b).

**Trazabilidad pedido → casos**: R1 (soporte Qwen) → C1, C2, C7, C8 · R2 (referencia qwen-code) → C7, C8 · R3 (detección por prompt en pi y opencode) → C1, C2, C6 · R4 (inteligencia por familia) → C1, C2, C3, C4, C5.

⚠️ **YATT no aplica** (no hay UI navegable): la verificación de este feature es `unit` (specs de la lógica de familia, corridos con bun/node) + la suite del proyecto `npm test` + smoke manual documentado en `verification.md`.

| ID | Caso | Fuente | Comportamiento esperado | Verificación | Tipo | Estado |
|---|---|---|---|---|---|---|
| C1 | Prompt en OpenCode con modelo Qwen | pedido (R3, R4) | En cada prompt la familia se detecta y la inteligencia Qwen queda activa (bloque de conducta Qwen en las instrucciones internas; sin asunciones GLM) | spec de la lógica de familia + aserción de que el plugin instalado registra los hooks de detección/inyección | unit | ✅ |
| C2 | Prompt en Pi con modelo Qwen | pedido (R3, R4) | Ídem, vía `before_agent_start` + `ctx.model` de la extensión Pi | spec de la lógica + aserción de la extensión | unit | ✅ |
| C3 | Prompt con modelo GLM (ambos entornos) | checklist (ya-existe-PARTE: hoy todo es GLM) | Regresión cero: comportamiento idéntico al actual (contrato de subagentes GLM intacto, notas GLM vigentes) | spec (glm → conducta GLM sin cambios) + suite `npm test` | unit | ✅ |
| C4 | Modelo de otra familia (kimi, deepseek, gpt…) | decisión 2b (GATE 1) | Trato de siempre: sin bloque inyectado, harness estático actual intacto (el trato GLM de hoy); `resolveFamily(unknown) → "glm"` para el contrato de subagentes | spec (desconocido → sin inyección, resolve → glm) | unit | ✅ |
| C5 | Contrato de subagentes (task tool) por familia | descubierto-código (REMINDER del plugin; `agent/droxon-agent.md:256`) | Cuando la familia es Qwen, la nota "el razonamiento oculto exige mensaje final completo" se sustituye por la nota Qwen equivalente | spec de generación de contrato por familia | unit | ✅ |
| C6 | Cambio de modelo a mitad de sesión | checklist (selección cambiada en vuelo) | La familia se reevalúa prompt a prompt (sin estado rancio del modelo anterior) | spec (detección stateless por prompt) | unit | ✅ |
| C7 | Detección robusta por ID y por endpoint | descubierto-research (qwen-code usa regex por nombre; `research/qwen-code-findings.md`) | `glm*`/z.ai → GLM · `qwen*`/dashscope/maas → Qwen · resto → desconocido. Tabla con IDs reales: glm-5.3-flash, qwen3-coder-plus, qwen3.6-plus, qwen3-coder-next, kimi-k2.5, deepseek… | spec con tabla de casos de detección | unit | ✅ |
| C8 | Veracidad documental | pedido (R1, R2) | README/package.json/docs dejan de decir "solo GLM"; nuevo `docs/qwen-notes.md` (equivalente de las GLM notes) consolidando el research de qwen-code | aserciones grep en la suite | unit | ✅ |
| C9 | Instalador sin regresión (ambos targets) | checklist | `npm test` completo en verde tras el cambio (instalación, idempotencia, merge, degradación) | suite completa del proyecto | unit | ✅ |
