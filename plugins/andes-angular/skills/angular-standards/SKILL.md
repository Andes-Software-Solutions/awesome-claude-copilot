---
name: angular-standards
description: "Use when writing, editing, or reviewing Angular code (components, templates, services, routing, forms, HTTP, SSR, tests): the andes non-negotiables — standalone + OnPush, signals-first and zoneless, native control flow, inject(), Signal Store for state — plus the angular-cli MCP grounding workflow."
---

# Angular standards

Detailed how-to lives in the `angular-developer` skill (read the `references/` file matching the work) and, for state, the `ngrx-signal-store` skill. This file is the short list every change is held to.

## Workflow

1. Ground in the workspace's pinned version with the `angular-cli` MCP server: `list_projects` (workspace path, Angular version, test framework, style language) → `get_best_practices` with that `workspacePath` (without it when there is no `angular.json`) → `search_documentation` whenever an API or version behavior is uncertain (`find_examples` too, on CLIs that expose it). angular.dev is the source of truth — don't assert version-specific behavior from memory.
2. Follow the project's own conventions first; reuse existing code; keep changes small.
3. After changing code, run `ng build`, then `ng test --watch=false` when specs exist or were added. Never run `ng update` unless asked.

## Non-negotiables

- **Components** — standalone only (omit redundant `standalone: true` on v19+); `ChangeDetectionStrategy.OnPush` on every component; `input()` / `output()` / `model()`, never `@Input()` / `@Output()`; the `host` object, not `@HostBinding` / `@HostListener`.
- **Templates** — native `@if` / `@for` / `@switch`, never `*ngIf` / `*ngFor` / `*ngSwitch`; every `@for` tracked on stable identity (not `$index` for mutable collections), `@empty` where the list can be empty; no complex logic or function calls in templates — derive in `computed()`.
- **Signals** — derive with `computed()` / `linkedSignal()`; `effect()` only to sync signals to non-signal APIs, never to propagate state; never write signals inside `computed()`; always call signals (`sig()`) and read them before any `await` in a reactive context; prefer `toSignal()` / `resource()` / `httpResource()` over manual `subscribe()`; unavoidable subscriptions get `takeUntilDestroyed()`.
- **DI** — `inject()`, not constructor parameters, and only in a valid injection context; `providedIn: 'root'` for singletons; component/route `providers` only for deliberately scoped lifetimes.
- **State** — per the `ngrx-signal-store` skill: non-trivial state in a `signalStore` (no hand-rolled `BehaviorSubject` services); `protectedState` on; `patchState` with standalone updaters that never mutate; `rxMethod` with `switchMap` / `exhaustMap` wherever requests can overlap — never `signalMethod` for racing HTTP; `withEntities`, one store per entity type; no classic NgRx actions/reducers/effects unless the Events plugin is a deliberate choice.
- **Routing** — lazy `loadComponent` / `loadChildren`; functional guards and resolvers; `withComponentInputBinding()` over `ActivatedRoute` plumbing; route-level `providers` for route-scoped stores.
- **Forms** — Signal Forms for new forms on v21+, otherwise the app's existing strategy; no `any`-typed form values; validation errors surfaced accessibly.
- **HTTP** — `provideHttpClient()` with functional interceptors; no nested `subscribe()` chains; overlapping user-driven requests cancellable; errors handled and stored per the skill's request-status pattern, never swallowed or console-only.
- **SSR / hydration** — no `window` / `document` / `localStorage` during construction or in `computed()`; DOM work in `afterNextRender` / `afterRenderEffect`; valid HTML structure; `ngSkipHydration` only as a documented temporary workaround.
- **Security** — interpolation over `[innerHTML]` with untrusted data; never `bypassSecurityTrust*` without documented justification; no direct DOM APIs without sanitization; no URLs built from raw user input; no secrets in client code or `environment.*` files.
- **Accessibility** — semantic elements over clickable `div`s; keyboard operability and visible focus; labeled controls; Angular Aria or native semantics before raw ARIA; WCAG AA contrast; focus management for dialogs and route changes.
- **Zoneless & performance** — never rely on zone.js patching (`NgZone.onStable` / `isStable` / `onMicrotaskEmpty`); `NgOptimizedImage` for static images; no impure pipes; strict TypeScript — no `any`, use `unknown` and narrow.
- **Tests** — the framework `list_projects` reports (Vitest on current versions); `provideZonelessChangeDetection()` in `TestBed`; `await fixture.whenStable()`, not `fixture.detectChanges()` or `fakeAsync`; component harnesses; store specs per `ngrx-signal-store` `references/testing.md` (`unprotected()`, never `protectedState: false` in production code). Cover the critical paths of what changed.
