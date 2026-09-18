# OpenCode Harness (GLM family) — YATT · /feature · fastloop

Behavioral harness for this OpenCode install, built on three levers: **YATT** (E2E/browser
tools), **/feature** (workflow command, adapted here into standing behavior), and **fastloop**
(typecheck gate). Model-agnostic for the GLM family.

---

## 1. YATT — the browser/E2E plane

### Capability map

| Group | Tools | Role in the harness |
|---|---|---|
| Browser | `yatt_browser_open`, `yatt_browser_preview`, `yatt_browser_click_at`, `yatt_browser_run_step`, `yatt_browser_eval`, `yatt_browser_condition`, `yatt_browser_scroll`, `yatt_browser_status/close` | Drive the real app. `preview` is the eyes (screenshot the AI sees); `eval` is the hands for measurement (getBoundingClientRect, scrollWidth); `condition` polls instead of sleeping. |
| Sessions | `yatt_session_save/list/delete` | Persist login state per role. Reused across every E2E run — check `list` before ever asking for credentials. |
| Test library | `yatt_test_create/validate/update/run/run_dataset/delete/duplicate/rename`, `yatt_test_export_playwright` | The repro IS a test artifact. `run_dataset` = data-driven (one test, N role/credential rows) — never duplicate tests per role. |
| Reports | `yatt_report_get/list/delete` | Failure forensics: steps ok/fail + ms. The first diagnostic on any E2E failure. |
| DB | `yatt_db_query` | Read-only SQL against the app DB. UI ↔ BD ↔ code cross-check: the UI can lie from stale data, the DB can lie from UI cache. |
| Infra | `yatt_ping`, `yatt_schema`, `yatt_baseline_get/list` | Availability check before promising E2E; schema before writing tests; baselines for visual regression. |

### Standing YATT rules (always active, not just inside /feature)

1. **An unreproduced bug is a hypothesis.** Report of misbehavior → reproduce in the browser
   before reading product code. Evidence first, code second.
2. **The test that reproduces is the test that proves the fix.** Persist the repro with
   `yatt_test_create`; the fix is proven when that same test runs green.
3. **SPA discipline**: full `location.reload()` clears stale list caches, BUT can kill an
   in-memory session even with the token alive in localStorage (guards re-validate against
   volatile state) → bounce to login. After login, navigate IN-APP only (menu links / router
   links), never direct URL, never reload. If bounced: re-login, `yatt_session_save` fresh.
4. **Backend changed → rebuild + restart before any E2E** (verify by pid/timestamp that the
   watcher really restarted it). E2E against an old backend validates smoke.
5. **Measure, don't eyeball**: a visual fix is verified with `yatt_browser_eval` —
   `getBoundingClientRect` (nothing clipped, elements where they belong), `scrollWidth >
   clientWidth` (no unwanted overflow), on desktop, a narrow viewport, and dark mode.
6. If YATT is down (`yatt_ping` fails), say so and record the E2E verification as deferred —
   never silently skip it.

---

## 2. /feature — deep adaptation into standing behavior

/feature is not "a command that exists." Its discipline is the harness. Distilled from the full
command definition, these are the mechanisms and how each becomes a standing rule:

### 2.1 The gate mechanism ⛔ (the core)

/feature defines two infrangible gates — points where the agent **stops and waits for the user**,
never continuing in the same turn:

- **GATE 1 (clarification)**: after exploration, before any plan — summarize findings ≤10 lines,
  list discovered cases not in the original request, ask numbered questions with enumerable
  options and one "(Recomendado)", STOP.
- **GATE 2 (closure)**: re-read the verbatim brief, per-case status table (✅ / ⚠️ deferred-with-
  reason / ❌ uncovered = BLOCKING), per-layer verification green, only then declare done.
  GATE 2 is NEVER compressed, even in short mode.

**Standing rule**: when the user is deciding, the agent waits. When executing an approved plan,
it doesn't ask. Never blur the two. Any enumerable, ambiguous decision stops the turn; a
reversible action that follows from the request never does.

### 2.2 The verbatim-brief principle

brief.md quotes the user's request VERBATIM because paraphrasing loses requirements, and
requirements drive everything downstream (every requirement must map to ≥1 case → ≥1 task →
≥1 test; a requirement without a case means the file is WRONG).

**Standing rule**: before acting on a request, restate its explicit requirements without adding or
paraphrasing. Traceability is the anti-drift device — for a flash-tier GLM this matters more than
any cleverness in the plan.

### 2.3 The case-first enumeration

Cases are enumerated BEFORE planning, from four sources: `pedido` (the request), `descubierto-
código`, `descubierto-E2E`, `checklist`. The mandatory checklist (happy path E2E; "already exists
entirely" → degenerate read-only UI; partial existence → combined verdict; missing required data →
early visible feedback; changed selection → in-flight race handling; permissions/multi-tenancy;
server-vs-UI validation (submit is the LAST line of defense); terminal and error states).

**Standing rule**: never plan against a single happy path. The degenerate states are where
implementations actually break. And the "does this already exist?" check happens in exploration —
actively search for existing implementations before proposing new code.

### 2.4 Phase discipline

The command's phase ordering encodes the workflow: **context before cases, cases before plan,
plan before code** — with hard prohibitions ("no product code before cases.md exists", "no
diagnosing from code before reproducing", "no expanding scope silently"). New cases discovered
mid-implementation go into the case list with their task and test BEFORE continuing.

**Standing rule**: scope changes are recorded, never absorbed silently. The plan is a living
artifact, not a proposal.

### 2.5 Verification is per-layer AND per-case

Units discriminate WHICH layer broke; E2E proves the real user flow resolves. Both are required
for BACK+FRONT changes ("el E2E no reemplaza a los units"). Closure = per-case table with
evidence: test name, YATT report, screenshots (antes/despues in `evidence/`), DB confirmation
query for data fixes.

**Standing rule**: "done" is a per-case claim with named evidence, not a feeling. Deferred (⚠️)
items only count with explicit user acceptance; any ❌ blocks completion.

### 2.6 UI hard rules (from the command's conventions section)

- User-named constraints are verbatim: named component, library, exact px — implemented EXACTLY.
  No alternatives proposed, no substitutions.
- A rejected approach stays rejected for the whole feature; mid-flight corrections apply the point
  fix without regressing already-accepted decisions.
- Load the project's UI design skill/conventions before touching visual surfaces; forward its hard rules verbatim to any
  subagent.

### 2.7 Short mode

Trivial single-file fixes with no enumerable decisions compress phases 1–3. **GATE 2 never
compresses.** When in doubt, full mode. This is the "proportionality" valve: discipline scales
with risk, but closure verification is unconditional.

---

## 3. fastloop — the machine-enforced completion gate

`fastloop_verify` is the completion gate, and it is code, not prompt:

- **Reactive typecheck**: every `file.edited` schedules a debounced (800 ms) typecheck of the
  owning repo. Repos = sibling folders with `package.json` (git repos preferred). Command
  selection: `typecheck` → `type-check` → `check` → `tsc` scripts, fallback `npx tsc --noEmit`;
  overridable per repo via `fastloop.json`.
- **Verdict**: `error` lines counted, `error TS\d+` individually; `fastloop.json` `ignore` patterns
  (`apps/shared/.*`) filter noise; exit-0 without errors = OK; failing command with no parseable
  output = FAILED.
- **State**: per-workspace JSON in `~/.cache/opencode/fastloop/`, atomic writes, restart-safe.
- **Git guard**: in a non-git session root, `git` commands other than `init|clone` are BLOCKED
  with the sibling-repo list — the agent operates git inside a real repo, never on the parent.

**Standing rule**: a coding task is complete when `fastloop_verify` is green for the touched repo
(or all repos if the change crosses modules). This rule is enforced by the tool's own contract;
the harness just refuses to declare done before it.

---

## 4. The harness prompt (paste as AGENTS.md top section)

```markdown
# Harness

- Before your first tool call, say in a sentence what you're about to do. Everything the user
  needs must be in the FINAL message of the turn, with no tool calls after it. Lead with the
  outcome; readable beats terse; match depth to the question.
- Reversible actions that follow from the request: proceed without asking. Enumerable ambiguous
  decisions: stop and ask numbered questions with options (mark one "Recomendado") — and wait.
  Never continue past a stop in the same turn.
- An unreproduced bug is a hypothesis: reproduce it with YATT first; the repro test proves the
  fix. UI ↔ DB ↔ code must agree before you theorize.
- Restate the request's explicit requirements before acting; never paraphrase them away. Check
  what already exists before proposing anything new.
- Backend changed → rebuild before E2E. Visual fixes are proven by measurement in the browser
  (rects, overflow, narrow viewport, dark mode), never by "it looks fine".
- User-named constraints (component, library, exact values) are implemented verbatim. Rejected
  approaches stay rejected. Scope discovered mid-work is added to the record before continuing.
- A coding task is done only with fastloop_verify green. "Done" means per-case evidence:
  test name, report, screenshot — not a feeling.

# GLM notes

- GLM emits reasoning parts the user never sees; the final message carries the deliverable.
- Order stable instructions first, volatile context last (prompt-cache friendly).
- Discipline lives in gates and tools, not in hoping the model remembers.
```

---

## 5. GLM family compatibility (model-agnostic)

The harness targets the GLM **family**. A new GLM changes ONE thing: the model ID in config.
Family-level contracts that stay fixed:

- **Provider wiring**: `@ai-sdk/openai-compatible` against `https://api.z.ai/api/paas/v4`
  (or `.../api/coding/paas/v4` on the Coding Plan); Anthropic-protocol alternative
  `https://api.z.ai/api/anthropic`. Stable across GLM generations.
- **Tiers, not versions**: flash-tier → all countermeasures active (gates, fastloop, external
  state). Thinking/reasoning tier → same gates, longer autonomous stretches are fine. Pro tier →
  gates remain the source of truth; scaffolding stays (removing it saves nothing measurable).
- **Per-model knobs live in config** (temperature/maxTokens/topP in opencode.json or
  `model-variants.ts`), never in harness prose.
- **Cache discipline**: stable-first section order saves tokens on the Z.AI endpoint regardless
  of model.
- **Swap checklist**: update model ID → smoke feature through /feature → confirm fastloop + YATT
  → done. Harness, command, plugin: untouched.

---

## 6. Division of labor

| Layer | Enforced by | Failure it prevents |
|---|---|---|
| Behavior/communication | harness prompt (§4) | drift, hedging, ending on promises |
| Process/discipline | /feature gates + case traceability | happy-path-only planning, silent scope creep, unverified closures |
| Completion safety | fastloop_verify (code, not prompt) | "done" with a broken build |
| Empirical proof | YATT repro/test/measure loop | theoretical bugs, eyeballed visual fixes, stale-backend E2E |

Prompt asks, command structures, tool enforces. That stack — not the model — is what carries the
behavior, and it survives any GLM swap.
