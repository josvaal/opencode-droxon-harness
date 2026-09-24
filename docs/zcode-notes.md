# ZCode notes — retroalimentación del harness abierto de Z.ai

Fuente: [github.com/zai-org/ZCode](https://github.com/zai-org/ZCode) (Apache-2.0,
liberado 2026-09). ZCode es un workbench completo (desktop Electron + web + CLI
`zcode` con TUI); no es una dependencia de droxon-harness, pero sus convenciones
internas son un espejo útil. Citas textuales (sin pin de commit) sobre `AGENTS.md` y `DESIGN.md`
de su repo (rama `main`, sept 2026).

## Hallazgos accionables

### 1. Gate de arquitectura mecánico (`pnpm verify:pre-push`, `architecture:check --changed`)

ZCode no confía en que el agente "siga las reglas": tiene comandos que fallan
el push si se violan (AGENTS.md, sección "Comandos y estructura del repo": `pnpm
verify:pre-push (Lint y chequeos de arquitectura)`, `pnpm architecture:check
--changed`). Es exactamente la filosofía de droxon (fastloop = gate mecánico),
pero ZCode la extiende a *arquitectura*, no solo a tipos.

**Adoptado (bajo riesgo):** entrypoint de verificación único del repo
(`npm test` → `tests/test-install.sh`), para que el gate del propio harness sea
un comando estándar y no conocimiento tribal.

**Futuro:** un chequeo mecánico de consistencia harness (p. ej. que cada
`agent/*.md` referenciado por `droxon-agent.md` exista, que `pi/prompts` y
`command/feature.md` no diverjan sin nota de port). Candidato para un script
`scripts/check-harness-consistency.sh`.

### 2. "Spec-first antes de tocar código" (AGENTS.md, sección "Principios centrales")

"Antes de agregar o modificar comportamiento, primero actualiza el spec
correspondiente…" — igual que el ciclo cases→plan→apply de `/feature`. Ya lo
cumpimos; sin cambio. La diferencia: ZCode lo exige para TODO cambio, droxon
solo dentro de `/feature`. Mantener así (los cambios triviales no deben pagar
el impuesto completo).

### 3. Contexto de módulo a demanda (`pnpm architecture:context <module-id>`, `CONTEXT.md`)

ZCode mantiene vocabulario de dominio por módulo y un comando que entrega el
contexto controlado de un módulo al agente. Para droxon: la FASE 1 de
`/feature` podría beneficiar de un artefacto estándar `context-index.md` por
proyecto (mapa módulo→archivos mantenido por memoria, no re-explorado).
**Futuro**, requiere diseño.

### 4. DESIGN.md como spec de UI portable con "highest-priority constraint"

Su `DESIGN.md` abre con una restricción tipográfica obligatoria ("Treat
violations of this section as design-system defects, not stylistic
preferences") y prohíbe explícitamente escalados por `html.fontSize`. Patrón
validado para `codicore-design` y para las "reglas duras" del usuario: nombrar
la violación como *defecto*, no como preferencia, cambia cómo un subagente la
trata. **Futuro**: redactar la sección de reglas duras de `codicore-design`
con ese framing (no toca el port a Pi).

### 5. Freshness check del workspace (`scripts/check-workspace-freshness.mjs`)

ZCode verifica que la baseline de arquitectura esté fresca antes de trabajar.
Idea análoga para droxon: `install.sh` ya es idempotente, pero podría avisar
cuando la copia instalada en `~/.config/opencode` o el agent dir de Pi es más
vieja que el repo (hash comparado). **Futuro**, bajo prioridad.

## Aplicado en este feature

- `package.json`: `"scripts": { "test": "tests/test-install.sh" }` — gate
  estándar del repo (inspirado en 1).

## No aplicable / descartado

- Desktop/Web/protocolo/owner-lease (secciones de procesos de su AGENTS.md):
  dominio de su arquitectura, sin análogo en droxon-harness.
- Su sistema de temas (Zai Light/Dark): no hay UI en droxon-harness.
