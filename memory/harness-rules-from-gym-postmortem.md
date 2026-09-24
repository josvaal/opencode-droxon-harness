---
name: harness-rules-from-gym-postmortem
description: Rules added to droxon-agent.md after the gym session postmortem (false-green gate, ignored design complaint, broken import, discarded question)
type: pattern
---

# Harness rules from the gym postmortem (2026-09-18)

**What**: Promoted three failure classes from a gym session retro into permanent hard rules in
`agent/droxon-agent.md`.

**Why**: A gym session failed in four ways: (1) treated a design-level complaint ("el filtro
corrompe todo") as a labels bug — two repeats needed to reach the real fix; (2) used
fastloop_verify (loose tsc) as proof of done on an Angular workspace — false-green twice, even
with the gotcha already documented in `gym/memory/verify-gates-and-user-processes.md`; (3) broke
the build with a mechanical import error; (4) offered a decision menu when the user had already
given the direction.

**Where**: `agent/droxon-agent.md` — Verification contract item 2 (adaptive real-build gate) and
Diagnostic discipline (diagnose-before-decorating + repeated-complaint escalation rules).

**Learned**: Project-level memory (`<project>/memory/`) fixes one project; failure classes belong
in the harness prompt so every project inherits them. A completion gate must state what it does
NOT cover, or agents will treat partial coverage as full coverage. Second lesson from the user:
when a gate is weak, don't patch surrounding config — make the RULE adaptive (detect the repo's
real build command and use it), which fixes every project at once. Verified in opencode-fastloop
source: fastloop falls back to `npx tsc --noEmit` when the repo has no typecheck/check script.

## Second retro (same day, second gym session) — 2026-09-18

**What**: Added three new hard rules and tightened two existing ones in `agent/droxon-agent.md`.

**Why**: The agent's own self-feedback reported 5 failures: (1) fixed a UI symptom for two extra
rounds when one intent question ("¿qué rol querés que tenga este chart?") was due from round 1;
(2) broke the build removing a still-used import (`formatDateFilterLabel`) while its own grep
showed the live usage on screen — evidence ignored; (3) the real gate (`ng build`) was only run
late — gate must be resolved from the FIRST edit, not at claim-of-done time; (4) chased a
"Failed to fetch" the user had explicitly cut from scope, including a no-token 401 fetch;
(5) speculative calls: a throwaway YATT session (`__tmp_check`) to probe the mechanism.

**Where / rules**:
- NEW `Intent-before-fix for UI/design reports` — one goal question before first edit on any
  aesthetic report (Diagnostic discipline).
- NEW `React to your own evidence` — broadened post-rename grep to ANY symbol removal; resolve
  contradictions shown by your own grep in the same step.
- TIGHTENED Real build gate — resolve the real verification command from the FIRST edit.
- NEW `A scope-cut kills the line of investigation IN THAT SAME MESSAGE` (Diagnostic discipline).
- NEW `No speculative calls: 10 seconds of thinking before executing` — bans dummy artifacts,
  predictable-401 fetches, exploratory calls; throwaway artifacts must be cleaned same turn.

**Learned**: The first retro's rules prevented repeats of classes 1 and 3 only partially — the
fixes needed teeth ("same message", "first edit", "one question BEFORE the first edit"), not just
statements of principle. Retro-driven harness iteration works: keep promoting each session's
failure classes into explicit, temporally-bounded rules.

## Third retro (gym UI-redesign session) — scope drift during verification

**What**: Added a new "Scope discipline" hard-rule block to `agent/droxon-agent.md`, and the
matching rules to `pi/agents-block.md` + `pi/skills/droxon-orchestrator/SKILL.md`.

**Why**: On a 100% frontend/UI task the agent escalated solo into infrastructure to enable
visual verification: started a NestJS backend, read `.env`, touched DB MySQL and login
credentials — 4 out-of-scope steps. The user had to complain twice ("te desvías DEMASIADO")
before the drift was cut. Related failure: excessive pre-exploration (routes, guards, env vars,
YATT tests) for a page redesign.

**Rules added (teeth, not principles)**:
- Task-type scoping binds verification: verification steps of another type than the task's
  declared type are OUT of scope even when they only serve verification.
- Verification-blocked → checkpoint the user with options; never escalate solo into another stack.
- Pre-step scope filter: "¿este paso está dentro de la tarea declarada?" — exploration counts.
- First complaint = stop and realign (re-read original task); never wait for a second complaint.

**Learned**: Scope drift has a distinctive signature: it enters through the verification path
("to verify I need login → backend → DB"), where every step looks locally reasonable. Rules must
name that exact chain and bind at the FIRST link. Also: drift-detection cannot rely on the
agent's self-policing alone — the user's first complaint must trigger a mandatory realign step.
