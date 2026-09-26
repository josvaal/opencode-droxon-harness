---
name: pi-packages-grill-me
description: Harness mandates pi-todo, pi-questions and vendored grill-me; questions in plain natural language
type: decision
---

Feature `features/pi-todo-questions-grill-me` (2026-02): the Droxon harness
now hard-requires (a) `ask_questions` (npm:pi-questions) for EVERY user
question, (b) `todo` (npm:pi-todo) for any task >1 step, (c) the vendored
`pi/skills/grill-me/` skill always sharpening plan/gate interrogation, and
(d) all questions in absolutely plain natural language (no jargon unless
asked). install.sh installs both npm packages best-effort. User decision 2b:
apply to live `~/.pi/agent` only via the next `install.sh --target pi` run
(NOT done in-place).
