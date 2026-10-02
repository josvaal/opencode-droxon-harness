---
name: droxon-angular22
description: Angular 22+ signal-first rules for ALL Angular code written or reviewed in the Droxon harness — signals, zoneless, OnPush default, standalone, native control flow, Signal Forms, inject(). Use for any Angular task (writing, refactoring, reviewing, generating components/services/forms/templates).
---

# Angular 22+ (Signal-First) — Hard Rules for the Droxon Harness

Source of truth: the official Angular context
(https://angular.dev/assets/context/best-practices.md) and the Angular v22
release notes. In v22 the signal-first model is the DEFAULT, not an opt-in:
zoneless since v21, OnPush since v22. Writing v15-style Angular is a defect.

## Zero-legacy checks (a violation is a review blocker)

- **Standalone is the default (v20+)**: NEVER write `standalone: true` in
  `@Component`/`@Directive`/`@Pipe`.
- **OnPush is the default (v22+)**: NEVER write
  `changeDetection: ChangeDetectionStrategy.OnPush` explicitly; never use the
  old `Default` strategy (renamed `Eager`).
- **Zoneless is the default (v21+)**: NEVER add `provideZoneChangeDetection`;
  never reintroduce zone.js. Code must not rely on Zone.js patching: async
  state changes must go through signals (or explicit
  `ChangeDetectionScheduler` refresh), not "it'll get picked up eventually".
- **No NgModule authoring**: standalone + lazy-loaded feature routes.

## Signals everywhere

- State: `signal()`; read via getter `count()`, mutate ONLY with `set()` /
  `update()` — never `mutate()`, never mutate object properties in place
  (signals compare with `Object.is`; replace the reference).
- Derived state: `computed()`. State linked to another signal that also needs
  local reset: `linkedSignal()`.
- Async data: `resource()` / `httpResource()` (stable in v22+) — not manual
  subscribe-and-store-into-a-field patterns.
- Debounce: `debounced()` / Signal Forms `debounce()` (v22), not RxJS glue
  when the source is a signal.

## Component APIs (function-style, no decorators)

- `input()` / `output()` instead of `@Input()`/`@Output()`.
- `model()` for two-way binding `[(prop)]` — never an `input()`+`output()` pair.
- Host bindings/listeners in the `host` object — NEVER `@HostBinding` /
  `@HostListener`.
- DI with the `inject()` function — not constructor parameter injection.
- Singleton services: `@Service` decorator (v22+) over
  `@Injectable({ providedIn: 'root' })`; single responsibility per service.

## Templates & forms

- Native control flow ONLY: `@if` / `@else` / `@for (track …)` / `@switch` —
  never `*ngIf`/`*ngFor`/`*ngSwitch`.
- NO `ngClass` / `ngStyle`: use `[class]` and `[style]` bindings.
- NO blanket `CommonModule` import: import only the directives/pipes used
  (e.g. `DatePipe`, `AsyncPipe`).
- New forms: **Signal Forms** (`@angular/forms/signals`, stable v22) — model
  as `signal()`, schema-based validation. Reactive Forms (not template-driven)
  only where Signal Forms genuinely don't fit.
- Observables in templates via `async` pipe; `toSignal()` at the boundary.
- Templates simple: no complex logic in them; no reliance on ambient globals
  (`new Date()` in a template is a bug under SSR/hydration).
- Relative paths for external templates/styles.
- Images: `NgOptimizedImage` (never for inline base64).
- Accessibility: WCAG AA minimums, must pass axe checks.

## When touching legacy code

- Do NOT modernize files outside the declared task scope (Droxon drift rules
  apply). BUT any NEW code, and any line the task touches, follows these rules.
- Conversions the task already covers (e.g. refactoring a component): migrate
  `@Input()`→`input()`, `*ngIf`→`@if`, constructor DI→`inject()` as part of
  the change; keep migrations atomic per file, never half-done.

## Review gate additions (Angular tasks)

When reviewing Angular changes, add these checks to the gate:
1. grep the diff for `standalone: true`, `OnPush` explicit, `@Input(`,
   `@Output(`, `@HostBinding`, `@HostListener`, `*ngIf`, `*ngFor`,
   `ngClass`, `ngStyle`, `CommonModule`, `constructor(` DI, `mutate(` —
   each hit needs justification or a fix.
2. Zoneless safety: no bare `setTimeout`-driven state that assumes a CD cycle;
   async mutations flow through signals.
3. Forms: new forms use Signal Forms; `valueChanges` subscriptions on new code
   are a smell (use `field.value` / signal reads).
