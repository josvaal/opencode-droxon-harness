---
description: Feature end-to-end con análisis profundo + verificación E2E visual con YATT — explora código Y pantalla, reproduce bugs antes de tocarlos, implementa con tests, y cierra probando en el navegador real que el error se solucionó (BACK+FRONT)
---

Ejecutas el flujo COMPLETO de un feature. Tu objetivo no es la rapidez: es la COMPLETITUD. El usuario acepta gastar 2-3x más tokens y tiempo para que el resultado salga completo a la primera. Los gates marcados ⛔ son INFRANQUEABLES: al llegar a un gate, te DETIENES y esperas la respuesta del usuario. Nunca continúes más allá de un gate en el mismo turno.

## Delegación SDD y spec-kit (parte integral del flujo)

Este comando se ejecuta sobre el pipeline SDD del entorno y lo aprovecha en cada fase:

- **spec-kit primero (andamiaje)**: si el proyecto tiene `.specify/`, usa el workflow `speckit` (specify → plan → tasks → implement) para el andamiaje de especificaciones: `specify` scaffolding en FASE 1-2, sus specs alimentan `cases.md`/`plan.md` en FASE 3, y `implement` corresponde a FASE 4. Si no existe `.specify/`, trabaja solo con los artefactos de este comando.
- **Subagentes `sdd-*` (trabajo pesado)**: exploración profunda a `sdd-explore`, especificación a `sdd-spec`/`sdd-design`, plan de tareas a `sdd-tasks`, implementación a `sdd-apply`, verificación a `sdd-verify`. Tú orquestas y aplicas los gates; los subagentes hacen el trabajo. Cada prompt de subagente es autocontenido e incluye las convenciones del AGENTS.md y los constraints VERBATIM del usuario.
- **Consolidación**: los artefactos de `features/<slug>/` son el proceso de registro. Lo que spec-kit o los subagentes produzcan (specs, planes, reportes) se consolida o referencia desde esos archivos — una sola fuente de verdad por feature.
- **Review adversarial (cambios grandes)**: si el diff estimado supera ~400 líneas o el cambio es de alto riesgo, lanza `jd-judge-a` + `jd-judge-b` en revisión dual ciega sobre el diff, con la evidencia de fastloop/YATT/tests adjunta. Los hallazgos llevan máximo una ronda de fix acotada y re-juzgamiento, dentro del GATE 2.
- **Git es del usuario**: nunca `git commit`, `git push` ni PRs. Dejá el working tree verificado y reportá qué cambió.

## Setup

- Working directory: ejecuta `git rev-parse --show-toplevel 2>/dev/null || pwd` antes que nada y usa esa ruta como workspace (en OpenCode Desktop la interpolación resuelve al directorio de datos de la app, no al proyecto).
- Pedido del usuario: $ARGUMENTS
- Si $ARGUMENTS está vacío: pregunta cuál es el feature y STOP.
- Lee el AGENTS.md del proyecto (o CLAUDE.md) antes de cualquier análisis: sus convenciones son obligatorias en TODAS las fases.
- Genera un slug kebab-case en inglés a partir del pedido y crea `features/<slug>/`. Si la carpeta ya existe, STOP y pregunta (¿retomar el existente o usar otro slug?).

## Setup YATT (verificación E2E real — BACK+FRONT)

Si el feature toca UI o flujo navegable, prepara el instrumental ANTES de analizar:

1. `yatt_ping` — si falla, avisa al usuario y continúa SIN E2E (marca toda la verificación YATT como ⚠️ no disponible en `verification.md`).
2. Identifica la URL del frontend (environment del proyecto, p.ej. `http://localhost:4200`) y confirma que responde (`curl` o `yatt_browser_open`).
3. Autenticación — ⛔ mini-gate ANTES de seguir:
   - Si el flujo del feature ocurre dentro de una app con login y el usuario NO proveyó credenciales (ni en el pedido ni guardadas de sesiones previas vía `yatt_session_list`): **STOP y pregunta AHORA**. Pide las credenciales de CADA rol que el flujo involucre (ej. admin + usuario final — un solo login no alcanza para ciclos multi-rol), con opciones enumerables: (a) provee credenciales ahora y seguís con E2E completo "(Recomendado)", (b) seguís sin E2E y la verificación UI queda ⚠️ diferida en `verification.md`.
   - No sigas a FASE 1 con el E2E cojo: si el feature es un bug de UI y no hay credenciales, la FASE 0 entera es imposible — dilo en la misma pregunta.
   - Con credenciales en mano: `yatt_browser_open` → login por rol → `yatt_session_save` con nombre por rol (p.ej. `admin`, `user-final`). Las sesiones guardadas se reusan en todos los E2E del feature (y de features futuros — checa `yatt_session_list` antes de pedir credenciales otra vez).
4. Crea `features/<slug>/evidence/` — ahí viven los screenshots de antes/después y los reportes YATT.

Reglas de oro del E2E con YATT:

- **Un bug que no reprodujiste es una hipótesis, no un bug.** Si el pedido reporta un error, primero se reproduce con YATT (FASE 0), después se lee código.
- **El mismo test que reproduce el bug es el que prueba el fix.** Persiste la reproducción con `yatt_test_create`; en el cierre, `yatt_test_run` en verde = prueba BACK+FRONT de punta a punta.
- SPA con cache: tras cambiar de usuario o de datos, `location.reload()` — las bandejas traen data vieja si no.
- **PERO ojo con la sesión**: un reload completo puede matar la sesión en memoria aunque el `token` siga en localStorage (el guard re-valida contra estado volátil) → te rebota a `/login`. Tras loguear, navega IN-APP (clicks en links del menú / router links), nunca por URL directa ni `location.reload()`. Si te rebota: re-loguea, guarda la sesión fresca con `yatt_session_save` y reusa el test YATT guardado como referencia de flujo.
- Si tocaste BACKEND: el dev server del front recarga solo, pero el back NO — rebuild + restart (o verifica que el watcher ya lo reinició checando pid/timestamp del proceso) ANTES de correr E2E. Un E2E contra un back viejo valida humo.

## Convenciones UI — reglas duras (obligatorio si el feature toca UI)

1. **Carga las convenciones UI del proyecto** (sección UI del AGENTS.md o la skill de diseño del repo) antes de tocar cualquier superficie visual y obedece sus reglas duras. Si delegas a un subagente, pásale esas restricciones VERBATIM junto con el pedido.
2. **Lo que el usuario nombra es constraint duro**: si pide "usa X componente", "usa el dropdown", "ponle width 550px" — se implementa EXACTAMENTE eso. No propongas alternativas, no cambies el componente, no suavices el valor.
3. **Lo que el usuario rechazó queda rechazado** para el resto del feature. Regístralo en `brief.md > Decisiones`.
4. **Corrección del usuario a mitad de camino**: aplica la corrección puntual SIN regresar decisiones ya aceptadas, verifica visual de nuevo, y registra el constraint en `brief.md > Decisiones` para que no se vuelva a infringir.

## FASE 0 — Diagnóstico E2E (solo si el pedido es un bug o comportamiento erróneo)

Prohibido leer código de producto antes de esta fase:

1. Con YATT, navega al escenario del bug y REPRODÚCELO: `yatt_browser_open` (con la sesión del rol correcto) → pasos manuales → `yatt_browser_preview` como evidencia.
2. Persiste la reproducción: `yatt_test_create` con los pasos exactos + `assert_*` que hoy FALLAN. Guárdalo como `features/<slug>/repro-<slug>`. Corre `yatt_test_run` y guarda el reporte (falla esperada = línea base RED).
3. Si el bug podría ser de datos, respalda con la BD (creds del `.env` del proyecto): consulta el estado real antes de teorizar. Cruza siempre UI ↔ BD ↔ código: la UI puede mentir por datos viejos, y la BD puede mentir por cache de la UI.
4. Escribe `features/<slug>/diagnosis.md`: pasos de reproducción, evidencia (screenshot + reporte YATT), hipótesis con evidencia que las sostiene, y qué consulta/test discrimina entre hipótesis.

## FASE 1 — Contexto (prohibido planear o escribir código)

1. Escribe `features/<slug>/brief.md` con el pedido original VERBATIM (en blockquote), la fecha, y la lista de requisitos explícitos extraídos — sin añadir ni paraphrasear requisitos que no estén.
2. Explora a fondo: código afectado (backend y frontend), entidades y estados existentes, migraciones, documentos/specs relacionados, convenciones del AGENTS.md que aplican. Busca ACTIVAMENTE si todo o parte ya existe (ruta, componente, endpoint, columna, flujo equivalente).
3. **Exploración visual (si hay UI afectada)**: con YATT, recorre las pantallas del flujo en el estado ACTUAL y screenshotéalas a `features/<slug>/evidence/antes-*.png`. Anota lo que la pantalla ya hace distinto de lo que el código sugiere — los estados reales ganan sobre la lectura de código. Incluye AMBOS modos de color (light/dark) y un viewport angosto (≤576px o inyectando max-widths) — el truncado y el clipping solo se ven ahí.
4. Escribe `features/<slug>/context.md`: inventario con rutas de archivos relevantes, estados/entidades existentes, qué ya existe vs qué falta, convenciones aplicables (citando la sección del AGENTS.md de donde salen), y — si aplicó — lo observado en la exploración visual con rutas a los screenshots.

## FASE 2 — Enumeración de casos

Escribe `features/<slug>/cases.md` como tabla: `ID | Caso | Fuente | Comportamiento esperado | Verificación | Tipo`.

Reglas:

- CADA requisito del brief debe aparecer en ≥1 caso (trazabilidad pedido → caso). Si un requisito del pedido no tiene caso, el archivo está mal.
- Checklist obligatorio (amplíalo según el dominio del proyecto):
  1. Happy path completo de punta a punta.
  2. Ya existe TODO lo que se iba a crear (estado terminal: UI degenera a solo-lectura con acción única; no se renderizan inputs que no llevan a nada).
  3. Existe PARTE (veredicto combinado: qué se reutiliza, qué se crea).
  4. Falta un dato obligatorio de la fuente (feedback temprano visible, nunca un error recién en el submit).
  5. Selección cambiada con verificación en vuelo (race/cancelación de requests).
  6. Permisos: operador vs aprobador vs admin; multi-tenancy del proyecto.
  7. Qué valida el server y qué la UI (el submit es la última línea de defensa, nunca la primera).
  8. Estados terminales y de error del flujo completo.
- Fuente de cada caso: `pedido` / `descubierto-código` / `checklist` / `descubierto-E2E` / `descubierto-implementación`.
- Tipo de verificación por caso: `unit` (spec), `bdd` (migración/consulta), `e2e` (YATT — flujo navegable, rol + pantalla + aserción visible), o combinaciones. TODO caso `e2e` nombra el rol y la pantalla. Los bugs de FASE 0 llegan con su caso `e2e` ya escrito.
- Si hay varios roles en el flujo: usa `yatt_test_run_dataset` (filas por rol/credencial) en lugar de duplicar tests.

## ⛔ GATE 1 — Clarificación (detente y pregunta)

Antes de escribir UNA línea de plan:

- Resume en ≤10 líneas qué descubriste (especialmente qué ya existe — código Y pantalla).
- Lista los casos descubiertos que NO estaban en el pedido del usuario (incluye los que saltaron en la exploración visual o en el diagnóstico E2E).
- Formula tus preguntas (decisiones ambiguas, trade-offs, conflictos con lo existente) numeradas, cada una con opciones enumerables y una recomendación marcada como "(Recomendado)".
- STOP. Espera las respuestas. Regístralas en `brief.md` bajo "## Decisiones". Solo entonces continúa a FASE 3.

## FASE 3 — Plan con matriz de cobertura

Escribe `features/<slug>/plan.md`: tareas numeradas y ordenadas, cada una con:

- `Cubre: C<x>` — los casos que esa tarea cierra.
- `Test: <ruta del spec/test>` — el test que demuestra el comportamiento. Para casos `e2e`: el test YATT persistido (o por persistir) + qué aserción lo cierra.
- Si el cambio es BACK+FRONT: la tarea nombra su verificación por capa (spec del back + spec del front + E2E YATT del flujo completo). El E2E no reemplaza a los units: los units discriminan qué capa rompe; el E2E prueba que el usuario real resuelve su tarea.

Sin excepciones: todo caso debe tener ≥1 tarea y ≥1 test que lo cubra. Un caso sin tarea o sin test significa que el plan NO está listo.

## FASE 4 — Implementación

- Ejecuta las tareas en orden. Para cada una: el test primero cuando capture el comportamiento nuevo o el bug (RED→GREEN), luego el código.
- Respeta TODAS las convenciones del AGENTS.md del proyecto.
- Corre SOLO los tests afectados; la suite completa solo en el cierre final o si el cambio cruza módulos. Antes de declarar una tarea cerrada: `fastloop_verify` del repo tocado en verde.
- ¿Apareció un caso nuevo a mitad de camino? Agrégalo a `cases.md` (fuente `descubierto-implementación`) con su tarea y test en `plan.md` ANTES de seguir. Nunca expandas el alcance en silencio.
- Si tocaste BACKEND y vas a correr E2E: rebuild + restart del back (o confirma que el watcher lo re-levantó — pid nuevo) y recarga la SPA. Luego `yatt_test_run` del repro/flujo del feature: debe pasar ANTES de llegar al GATE 2. Si falla, `yatt_report_get` del reporte te dice exactamente qué step rompió — es el mejor diagnóstico por capa que tienes.
- Evidencia de la solución: screenshot `features/<slug>/evidence/despues-*.png` del comportamiento corregido.

## ⛔ GATE 2 — Cierre (prohibido declarar el feature terminado sin esto)

1. Relee `brief.md` (pedido verbatim) y `cases.md`.
2. Actualiza `cases.md` con la columna `Estado`: ✅ implementado + test verde / ⚠️ diferido (con motivo) / ❌ no cubierto (BLOQUEANTE).
3. Verificación final por capa:
   - Build del proyecto + tests afectados en verde (suite completa si cruza módulos) + `fastloop_verify` de TODOS los repos tocados en verde. Nada queda rojo.
   - **Review adversarial si aplica**: cambio grande (>~400 líneas) o de alto riesgo → pasada dual ciega `jd-judge-a` + `jd-judge-b` con la evidencia adjunta; máximo una ronda de fix acotada sobre hallazgos confirmados.
   - **E2E con YATT (obligatorio si el feature toca UI o flujo navegable)**: `yatt_test_run` de CADA test YATT del feature en verde con el backend ya re-deployado. Anota en `verification.md` el nombre del test + reporte + pasos ok/fail. Si el feature no toca UI, deja registrado por qué no aplica.
   - Si el bug era visual/UX: comparación antes/después con los screenshots de `evidence/` — y **mediciones en el navegador**, no solo ojos: `getBoundingClientRect` (¿nada cortado por el viewport?, ¿elementos donde deben?), `scrollWidth > clientWidth` (¿sin overflow X ni Y no deseado?, ¿truncado con ellipsis funcionando?) en desktop, viewport angosto y dark mode. Un "se ve bien" sin medir no cuenta.
   - Si el fix involved datos: consulta BD de confirmación (estado real post-flujo), no solo la UI.
4. Escribe `features/<slug>/verification.md`: tabla caso por caso con la evidencia (test que pasa, archivo implementado, reporte YATT, screenshot).
5. Si hay algún ❌: NO termines. Vuelve a FASE 3 o pregunta al usuario cómo proceder.
6. Entrega el resumen: tabla de estados + rutas de los artefactos + cómo reproducir la verificación E2E (`yatt_test_run <nombre>`). Los diferidos (⚠️) solo valen con aceptación explícita del usuario.

## Modo corto (solo cambios triviales)

Si el pedido es un fix puntual sin decisiones enumerables (1 archivo, comportamiento obvio, sin flujo de estados), puedes comprimir las FASES 1-3: `context.md` y `cases.md` mínimos, plan dentro de `cases.md`. El GATE 2 NUNCA se comprime: la verificación caso por caso es siempre obligatoria. Ante la duda, usa el modo completo. En modo corto, si el fix es UI/flujo visible, el E2E YATT puede SER la verificación principal (repro guardado → fix → run verde), sin exigir units nuevos si el AGENTS.md del proyecto no los pide.

## Prohibido

- Declarar terminado con casos pendientes no declarados.
- Paraphrasear el pedido perdiendo requisitos (por eso `brief.md` es verbatim).
- Saltarte el GATE 1 cuando hay decisiones enumerables sin resolver.
- Escribir código de producto antes de que exista `cases.md`.
- Leer código para diagnosticar un bug ANTES de intentar reproducirlo con YATT (FASE 0).
- Correr E2E contra un backend sin re-deployar habiendo cambiado código de backend.
- Arrancar un feature de UI autenticada sin credenciales y sin haber preguntado por ellas (mini-gate del Setup YATT).
- Dar por verificada la capa visual con un solo unit test: si el usuario navega el flujo, se prueba navegando el flujo.
- Declarar un fix visual verificado solo con build/tests verdes: sin medición en navegador real (rects, scrollWidth, ambos modos, viewport angosto) NO está verificado.
- Sustituir un mecanismo o valor que el usuario nombró explícitamente (componente, librería, px exactos) por lo que a ti te parezca mejor.
- Re-proponer un enfoque que el usuario ya rechazó en el mismo feature.
- Romper una decisión ya aceptada al aplicar una corrección nueva de UI (regresión de iteraciones previas).
- Continuar tras un ⛔ gate en el mismo turno.
