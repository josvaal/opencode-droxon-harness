# Brief — Pi Agent support for droxon-harness

Date: 2026-09-23

## Pedido original (VERBATIM)

> Quisiera que ahora droxon harness tenga la capacidad de instalarse tambien a PI agent, obviamente el install.sh tendra la opcion para escoger (1) OpenCode, (2) Pi Agent . y que todo, absolutamente todo funcione bien tal cual. Ademas recuerda que ahora el harness de ZCode es libre! https://github.com/zai-org/ZCode puedes aprovechar y retroalimentar para mejorar el harness de droxon!

## Requisitos explícitos extraídos

1. El harness debe poder instalarse también en **Pi Agent** (además de OpenCode).
2. `install.sh` debe presentar una opción interactiva: `(1) OpenCode`, `(2) Pi Agent`.
3. "Todo, absolutamente todo funciona bien tal cual": la instalación en Pi debe ser completa y funcional (no un port a medias) — agentes, comando, plugin/hook, logo/TUI, dependencias en lo que Pi soporte.
4. Aprovechar que **ZCode es ahora open source** (github.com/zai-org/ZCode) para retroalimentar/mejorar el harness de droxon.

## Decisiones (GATE 1 — 2026-09-23)

1. **Mecanismo de instalación en Pi**: usar el ecosistema de **Pi packages** (pi.dev/packages) — el harness se convierte en un Pi package instalable (`pi install <ruta del repo>`), y el instalador trae paquetes del catálogo para lo que Pi no tiene nativo (ej. `npm:pi-subagents` para subagentes). No convertir a mano los sdd-*.
2. **Orquestador en Pi**: contenido inyectado en `~/.pi/agent/AGENTS.md` (merge si existe, backup `.bak-droxon`).
3. **ZCode**: estudio + `docs/zcode-notes.md` con hallazgos accionables; aplicar solo mejoras de bajo riesgo que no toquen el port a Pi.
4. **Instalador**: menú interactivo `(1) OpenCode (2) Pi Agent` **+** flags `--target opencode|pi` y env var para CI/no-interactivo.
