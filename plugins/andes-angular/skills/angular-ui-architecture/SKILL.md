---
name: angular-ui-architecture
description: "Use when adding, moving, or naming files in an Angular src/app workspace, deciding where a component, store, service, guard, token, model, or util belongs, registering a route or path alias, or wiring ESLint layer bans: kind-first folders (pages, components/<feature>, state, services, core, shared), file suffixes, one-way dependency direction, and design-system-first, mobile-first styling."
---

# Angular UI architecture (`src/app/`)

Where a file goes and what it is called. Code is grouped by **kind** at the top level and by **feature** one level down: every page is under `pages/`, every store under `state/`, and a feature's pieces share one folder name across those kinds. Dependencies run one way and ESLint enforces it. This skill fixes folder, name, and scope; component authoring is `angular-standards`, store authoring is `ngrx-signal-store`. Examples use a placeholder feature named `chat`.

```text
src/app/
├── pages/<feature>/          route destinations, + <feature>.routes.ts if it owns child routes
├── components/<feature>/     components only that feature renders
├── state/                    root stores flat; state/<feature>/ for provided stores
├── services/<domain>/        transports, and clients two or more consumers share
├── core/<topic>/             auth, config, http, errors, events, navigation, store features, telemetry
├── shared/
│   ├── components/<name>/    reusable components (presentational, or bound to root stores only)
│   ├── directives/  pipes/
│   ├── models/               DTOs and shared types — no Angular, no NgRx
│   └── utils/<topic>/        pure functions — no Angular, no NgRx
├── app.ts  app.config.ts  app.routes.ts
src/testing/                  fixtures, fakes, shared test providers (@testing/*)
```

## Rules that apply everywhere

- **Kind first, feature second.** A feature named `chat` has `pages/chat/`, `components/chat/`, `state/chat/`. The same folder name in every kind folder is what makes a feature findable.
- **Component files are suffix-free**: `chat.ts` / `chat.html` / `chat.scss`, class `Chat`, selector `app-chat`. Every other kind carries its suffix, except pure functions under `shared/utils/`: `-store.ts`, `-client.ts` / `-service.ts`, `.guard.ts`, `.resolver.ts`, `.interceptor.ts`, `.routes.ts` (a `Routes` array), `-route.ts` (a URL or query-param contract), `.token.ts`, `.model.ts`, `with-*.ts`. The separator is part of the convention: a **dash** where the suffix says what the file is one of (`-store`, `-client`, `-service`, `-route`), a **dot** on the Angular artefact kinds (`.guard`, `.resolver`, `.interceptor`, `.routes`, `.token`, `.model`). Pin the schematic naming options in `angular.json` so `ng generate` produces these shapes; confirm option names through the `angular-cli` MCP server.
- **One component per folder only under `shared/components/`** (`shared/components/empty-state/empty-state.ts`). Under `components/<feature>/` files sit flat, nesting one level when a feature has sub-areas (`components/chat/transcript/assistant-turn.ts`). No `models/` or `utils/` sub-folders inside `components/` — a feature type is `<name>.model.ts` beside its consumer, because a `models/` folder under `components/` reads as a feature named models.
- **No barrel `index.ts`.** Import by full aliased path. Barrels hide the layer an import crosses and defeat tree-shaking of lazy chunks.
- **Specs are colocated**: `foo.spec.ts`, `foo.a11y.spec.ts`; one spec may cover a folder of tiny presentational components. Specs are exempt from every layer ban. Fixtures and fakes live in `src/testing/`, outside `src/app`.
- **One path alias per top-level folder**: `@pages/*`, `@components/*`, `@state/*`, `@services/*`, `@core/*`, `@shared/*`, `@testing/*`. Cross-layer imports use the alias; imports inside one folder may be relative.
- **Import statements** are ordered Angular → `@shared/models` → `@core` → `@services` → `@state` → `@shared` → `@components` → relative, which reads the dependency graph bottom-up; a component's `imports:` array is alphabetized.

## Dependency direction

```text
pages → components/<feature> → shared/components|directives|pipes → state → services → core → shared/utils → shared/models
```

- **Each layer imports only itself and the layers below it.** `shared/` is split across the graph on purpose: `shared/components` sits above `state` and may bind to root stores (a toast region, a user footer, a theme toggle), while `shared/utils` and `shared/models` sit at the bottom and import nothing from `@angular/*` or `@ngrx/*`, so they test in Node without a `TestBed`. Every `shared/` folder keeps its place in the graph and in the bans whether or not a given repo has filled it yet — an empty `shared/pipes/` is the layout, not drift.
- **`core` never imports `state`.** Guards and interceptors must not depend on what screens render. A core service that must kick a store dispatches an event the store observes in `withEventHandlers` (for example a sign-out event every store resets on). A store that a guard, interceptor, or core service injects (`SessionStore`, `ToastStore`) is core infrastructure and stays in `core/`.
- **Cross-feature imports are banned** between `components/<a>` and `components/<b>` and between `pages/<a>` and `pages/<b>`. Pages are where cross-feature composition legally happens. `state/<a>` may import `state/<b>`: folders under `state/` are domains, not screens, and the domain graph stays acyclic by convention.
- **`shared/components` may inject root stores, never `state/<feature>/` stores.** A `NullInjectorError` is the symptom of a shared component that crossed a provider boundary.
- **Two features want the same store-connected component.** Presentational → `shared/components`. Bound to root stores only → `shared/components`. Bound to a provided store → a pageless feature, `components/<thing>/` + `state/<thing>/`, that pages compose (`components/composer/` + `state/composer/`). Two features that must *talk* → a contract in `core/<topic>/` (a token or an event group), never an import.
- **Enforcement** is one ESLint `no-restricted-imports` block per folder, spec files exempt, generated per feature from the top-level folders of `components/` and `pages/`. Copy `assets/eslint-layer-bans.js` and read `references/enforcement.md` for the ban table, the aliases, and the traps.

## Placement

| I have a… | It goes to | Because |
| --- | --- | --- |
| Route component (a `loadComponent` target) | `pages/<feature>/<name>.ts` | The chunk boundary; an initial-chunk gate, if the project runs one, roots here |
| Feature route table | `pages/<feature>/<feature>.routes.ts`, default export | Only a feature owning child routes needs one; a nested detail route adds a second, `<entity>-detail.routes.ts`. Route-level `providers:` live here when child routes share one store instance |
| Component one feature renders | `components/<feature>/<name>.ts` | Screens own their parts |
| Component two or more features render, bound to inputs or root stores only | `shared/components/<name>/<name>.ts` | Reusable; lint caps it at root stores |
| Component two or more features render that needs a provided store | `components/<thing>/` + `state/<thing>/`, a pageless feature | Pages compose it; `components/<a> → components/<b>` stays banned |
| `signalStore({ providedIn: 'root' })` | `state/<name>-store.ts`, flat | App-wide state is one folder |
| Store a guard, interceptor, or core service injects | `core/<topic>/<name>-store.ts` | `core` never imports `state` |
| Store provided on one page or route | `state/<feature>/<name>-store.ts` | The folder is the domain; `providers:` is the scope |
| Non-root store provided by two features | `state/<domain>/<name>-store.ts` | Provided twice on purpose — the instances must not share; "root" is a provider scope, not a folder |
| Component-provided `@Injectable` written by one feature, read by another | `core/<topic>/<name>.ts` | A seam is a contract nobody owns; scope still comes from `providers:` on the page |
| HTTP call one store owns | in that store, `state/<name>-store.ts` | A client wrapping a single store's fetch is indirection, not a layer |
| Streaming transport, or a client two or more consumers share | `services/<domain>/<name>-client.ts`; non-HTTP `-service.ts`; its test-seam token beside it | Always a domain sub-folder — a flat `services/` reads as noise past four files |
| Streaming or agent-protocol client (a subclass of a vendor SDK transport) | `services/agents/<name>-client.ts` | It is a streaming transport; the library that drives it is configured in the page's `provide*()` |
| Route resolver | `pages/<feature>/<name>.resolver.ts` | Only its routes run it |
| Service a component provides for its own subtree | `components/<feature>/<name>-service.ts` | Its scope is that component's `providers:`; one another feature reads is a seam in `core/` |
| Reusable `signalStoreFeature` | `core/state/with-<name>.ts` | Store policy; imports only `core/` |
| Event group | `core/events/<domain>-events.ts` | The only legal upward signal out of `core` |
| `InjectionToken` with one owner | beside the owner, `<name>.token.ts` | A token exists for its consumer |
| `InjectionToken` implemented across features | `core/<topic>/<name>.token.ts`, its `provideX()` in the same file | `core` is the one layer every side reaches |
| Form component | `components/<feature>/<name>-dialog.ts` | The feature owns its forms; server validation maps through `core/errors/` |
| Form policy (limits, pure validators) | `components/<feature>/<name>-form.ts` beside the dialog; `shared/utils/<domain>/` once a store reads it | One consumer is not policy |
| Route path constants | `core/navigation/route-paths.ts`, one file | Guards read them and `core` cannot import `pages` |
| URL or query-param contract of one feature | `pages/<feature>/<feature>-route.ts`; `shared/utils/navigation/` once a store reads it | The lowest layer that reads it |
| Wire DTO | `shared/models/api/<resource>.model.ts`; a vendored contract under `shared/models/<topic>/` | Mirrors the API's DTO project |
| Pure function | `shared/utils/<topic>/<name>.ts`, no suffix | Node-testable by lint, not by convention |
| Generic directive or pipe | `shared/directives/<name>.ts`, `shared/pipes/<name>.ts`, flat | Small files; a folder each is noise |
| Directive that injects a feature store | `components/<feature>/<name>.ts` | Injecting a feature store makes it that feature's |
| `provide*()` function | page-scoped → `components/<feature>/`; app-scoped → `core/<topic>/` | Only `app.config.ts`, `*.routes.ts`, and pages call them |
| Test fixture or fake | `src/testing/<topic>.ts` | Outside the app graph; may import anything |

## Pages, chunks, and store scope

- **`app.routes.ts` is the only eager route table.** Every page is reached through `loadComponent` or `loadChildren`; guards and matchers come from `core/`; query params arrive as `input()` through `withComponentInputBinding()`. Eager exceptions (a sign-in callback, the failure pages) are listed in the table, never implied.
- **The initial graph is what `main.ts`, `app.*`, and `core/**` statically import.** Nothing under `pages/`, `components/`, or `state/<feature>/` may be imported from there. An optional initial-chunk gate (`references/enforcement.md`) fails the build when it happens.
- **A page's `providers:` lists the stores and `provide*()` calls whose files are reached only from its own chunk.** Nothing only a lazy screen renders is `providedIn: 'root'` — root provision does not pull code into the initial graph by itself, but the static import that accompanies it does.
- **One store per entity type.** Root stores flat in `state/`; provided stores in `state/<feature>/`; the store's lifetime is decided by `providedIn` or `providers:`, never by its folder. Compose the shared `core/state/with-*` features, and a reset feature that snapshots state at construction **last**, so no state-contributing feature after it survives the reset.
- **Cross-store coordination goes through `core/events/`.** A component never subscribes to `Events`; the store does, in `withEventHandlers`.

## Styling and layout

- **Design system first.** Reach for the design system's components and utilities before writing CSS: its grid and flex utilities for layout, its spacing and typography scales, its cards, lists, alerts, badges, placeholders, spinners, and tables. Interactive widgets come from the design system's Angular integration as standalone directives and services, never from a global JavaScript bundle.
- **Custom CSS is the exception.** A component stylesheet holds only what utilities cannot express, reads the theme's CSS custom properties rather than hex values, and stays inside the `anyComponentStyle` budget. Global styles are partials, `src/styles/_<topic>.scss`, pulled in with `@use`. CSS only a lazy page needs ships as a non-injected style bundle (`inject: false` plus a `bundleName` in `angular.json`) that the page loads, because every global stylesheet counts against the initial budget.
- **Mobile-first.** Lay a screen out for about 360 px, then add breakpoint utilities for wider screens. No fixed pixel widths on layout containers; full-height layouts use `100dvh`; tables and code blocks scroll inside their container instead of widening the page; interactive targets meet WCAG 2.2's 24×24 px minimum. A panel that is a sidebar on large screens becomes an off-canvas drawer on small ones rather than a second layout. Check every screen at 360, 768, and 1280 px in every theme.
- **The palette only through theme tokens.** Colours come from the theme the global stylesheet configures; a new colour joins that palette block and is never inlined in a component or template. Every text and background pair meets WCAG AA in every theme, and a component that bakes in the primary colour gets its dark-theme override when the app first uses it.
- **Third-party design systems are themed, not adopted.** A library that ships its own look is restyled in one global partial that maps its CSS custom properties onto the theme's tokens and follows the theme switch. Its utility classes never appear in our templates, and our markup rendered inside it carries an isolating wrapper class the same partial defines.
- Icons are inline icon-font or SVG elements with `aria-hidden="true"` beside visible or visually-hidden text.
- Bootstrap 5.3 + ng-bootstrap specifics: `references/bootstrap.md`.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| `references/enforcement.md` | Adding or changing the ESLint layer bans, a top-level folder, or a path alias; a "Crosses a layer boundary" lint error; setting up an initial-chunk gate |
| `references/bootstrap.md` | The workspace uses Bootstrap 5.3 / ng-bootstrap and you are writing styles, theming, restyling a third-party kit, or choosing a widget |
