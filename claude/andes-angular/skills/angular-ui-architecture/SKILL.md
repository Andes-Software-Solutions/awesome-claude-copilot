---
name: angular-ui-architecture
description: "Use when adding, moving, or naming files in an Angular src/app workspace, deciding where a component, store, service, guard, token, model, or function belongs, registering a route or path alias, or wiring ESLint layer bans: Angular's feature-first layout (core, features, shared), the CLI's default file names, one-way dependency direction, and design-system-first, mobile-first styling."
---

# Angular UI architecture (`src/app/`)

Where a file goes and what it is called, following the angular.dev style guide: organize by feature area, never by type of code, and name files the way `ng generate` does. Dependencies run one way and ESLint enforces it. This skill fixes folder, name, and scope; component authoring is `angular-standards`, store authoring is `ngrx-signal-store`. Examples use a placeholder feature named `chat`.

```text
src/app/
├── core/<topic>/          app-wide singletons by topic: auth/, api/, config/, errors/, events/,
│                          layout/, navigation/, telemetry/ …
├── features/<feature>/    everything one feature owns, flat: its routes, components, stores,
│   └── <area>/            data access, resolvers, and types; one folder per sub-area as it grows
├── shared/<theme>/        reusable pieces with no business logic: empty-state/, formatting/, dates/ …
├── app.ts  app.config.ts  app.routes.ts
src/testing/               fakes, fixtures, shared test providers (@testing/*)
```

## Rules that apply everywhere

- **Feature areas, never code types.** Every folder under `core/`, `features/`, and `shared/` names a feature, a sub-area, or a topic — never a kind of code. No `components/`, `directives/`, `pipes/`, `services/`, `models/`, `utils/`, or `state/` folders: the style guide says to avoid "subdirectories based on the type of code". Related files sit together; when a folder gets hard to scan, split it by sub-area (`features/chat/transcript/`).
- **File names are the CLI's defaults.** Hyphenated, matching the identifier inside: `chat.ts` / `chat.html` / `chat.scss` hold class `Chat`, selector `app-chat`. Components, directives, and services carry no suffix; a service is named for its intent (`chat-data.ts` → `ChatData`, `chat-client.ts` for a streaming transport). Guards, interceptors, resolvers, and pipes carry the CLI's dash suffix: `auth-guard.ts`, `auth-interceptor.ts`, `chat-resolver.ts`, `format-date-pipe.ts`. Stores follow NgRx's docs: `<name>-store.ts`, `with-<name>.ts`, `<domain>-events.ts`. Anything else is named for its intent, the style guide's way: `-data`, `-client`, `-dialog`, `-form`, `-route` (a URL contract), `-token`. A dot appears only where Angular uses one: `.spec.ts`, `.routes.ts` (a `Routes` array), `.config.ts`, and `.model.ts` (types and DTOs). Pin nothing in `angular.json` — the CLI's defaults are the convention.
- **One concept per file.** A component's TypeScript, template, and styles share its name and folder.
- **No barrel `index.ts`.** Import by full aliased path. Barrels hide the boundary an import crosses and defeat tree-shaking of lazy chunks.
- **Specs are colocated** and named after the file under test: `chat.spec.ts`, `chat.a11y.spec.ts`. Specs are exempt from every layer ban. Fakes and fixtures live in `src/testing/`, outside `src/app`, the way Angular ships its own test helpers as `…/testing` entry points.
- **One path alias per top-level folder**: `@core/*`, `@features/*`, `@shared/*`, `@testing/*`. Imports that cross a top-level folder use the alias; imports inside one feature or topic are relative.
- **Import statements** are ordered Angular → `@core` → `@shared` → `@features` → relative; a component's `imports:` array is alphabetized.
- **An existing workspace keeps its style.** One created before v20 may carry the 2016 names (`chat.component.ts`, `auth.guard.ts`). Never mix the two styles in one folder; rename a whole feature at a time.

## Dependency direction

```text
features/<feature> → shared → core/**/*.model.ts
features/<feature> → core → shared
```

- **Features never import each other.** What two features need is promoted by what it is: presentational (inputs and outputs only) → `shared/<theme>/`; bound to app-wide state or a singleton → `core/<topic>/`. Two features that must *talk* use a contract in `core/<topic>/` (a token or an event group), never an import.
- **`core` never imports `features`.** Guards and interceptors must not depend on what screens render. A core service that must kick a feature store dispatches an event the store observes in `withEventHandlers` (for example a sign-out event every store resets on). A store that a guard, interceptor, or core service injects (`SessionStore`, `ToastStore`) is core infrastructure and lives in `core/<topic>/`.
- **`shared` has no business logic.** It imports only `shared/` and `*.model.ts` types — never a store, a singleton service, or a feature. A component bound to app-wide state (a toast region, a theme toggle, a user menu) is part of the app shell: `core/layout/`.
- **`*.model.ts` files import no `@angular/*`, `@ngrx/*`, or app code other than other models**, and still follow their folder's direction, so types test in Node without a `TestBed`. Pure functions stay Angular-free the same way; no folder marks them, so lint cannot.
- **Enforcement** is one ESLint `no-restricted-imports` block per top-level folder and per feature, spec files exempt, generated from the folders under `features/`. Copy `assets/eslint-layer-bans.js` and read `references/enforcement.md` for the ban table, the aliases, and the traps.

## Placement

| I have a… | It goes to | Because |
| --- | --- | --- |
| Route component (a `loadComponent` target) | `features/<feature>/<feature>.ts`; a second route in the feature is `<name>.ts` beside it | The feature folder is the chunk boundary |
| Primary landing page | `features/<feature>/<feature>.ts`, referenced with `component:` in `app.routes.ts` | Angular loads the landing page eagerly |
| Feature route table | `features/<feature>/<feature>.routes.ts`, default export | Only a feature with child routes needs one. Route-level `providers:` live here when child routes share one store instance |
| Component one feature renders | `features/<feature>/<name>.ts`, or `features/<feature>/<area>/<name>.ts` | Related files sit together |
| Presentational component two or more features render | `shared/<theme>/<name>.ts` (`shared/empty-state/empty-state.ts`) | Reusable, no business logic |
| Component bound to app-wide state | `core/layout/<name>.ts`, or the `core/<topic>/` it serves | It is part of the app shell |
| Stateful widget several features render, each with its own instance | `core/<topic>/` with its store and `provide<Thing>()`, provided on each feature's route | Features never import each other |
| Root store (`providedIn: 'root'`) | `core/<topic>/<name>-store.ts` | App-wide state is core infrastructure |
| Store provided on one feature's routes | `features/<feature>/<name>-store.ts` | The folder is the feature; `providers:` is the scope |
| Reusable `signalStoreFeature` | `core/<topic>/with-<name>.ts`, beside the topic it serves | Store policy; imports only `core/` |
| Event group | `core/events/<domain>-events.ts` | The only legal upward signal out of `core` |
| HTTP one store owns | in that store — `httpResource` for reads | A client wrapping a single store's fetch is indirection, not a layer |
| Data access several pieces of one feature share | `features/<feature>/<name>-data.ts` | The feature owns it |
| Client two or more features share, or a streaming transport | `core/<topic>/<name>-client.ts` or `<name>-data.ts`, its test-seam token beside it | `core` is the one layer every feature reaches |
| App-wide guard or matcher | `core/<topic>/<name>-guard.ts` (`core/auth/auth-guard.ts`) | Guards read app-wide state and route paths |
| One feature's own guard (`canDeactivate`) | `features/<feature>/<name>-guard.ts` | Only its routes run it |
| Route resolver | `features/<feature>/<name>-resolver.ts` | Only its routes run it |
| Interceptor | `core/<topic>/<name>-interceptor.ts` (`core/auth/`, `core/errors/`) | Registered once, in `app.config.ts` |
| Service a component provides for its own subtree | `features/<feature>/<name>.ts`, `@Service({ autoProvided: false })` on v22+, a bare `@Injectable()` below | Its scope is that component's `providers:` |
| `InjectionToken` with one owner | in the owner's file | A token exists for its consumer |
| `InjectionToken` implemented across features | `core/<topic>/<name>-token.ts`, its `provideX()` in the same file | `core` is the one layer every side reaches |
| Form component | `features/<feature>/<name>-dialog.ts` | The feature owns its forms; server validation maps through `core/errors/` |
| Form policy (limits, pure validators) | `features/<feature>/<name>-form.ts` beside the dialog; `shared/<theme>/` once two features read it | One consumer is not policy |
| Route path constants | `core/navigation/route-paths.ts`, one file | Guards read them and `core` cannot import `features` |
| URL or query-param contract of one feature | `features/<feature>/<feature>-route.ts` | The feature owns its URL |
| Wire DTO | `core/api/<resource>.model.ts`; a vendored contract under `core/<topic>/` | System-wide models live in `core`, mirroring the API's DTO project |
| Feature type | `features/<feature>/<name>.model.ts` | Beside its consumers |
| Pure function | beside its only consumer; `shared/<theme>/<name>.ts` once two features use it (`shared/dates/format-relative.ts`) | Grouped by what it is for, not what it is |
| Generic directive or pipe | `shared/<theme>/<name>.ts`, `shared/<theme>/<name>-pipe.ts` (`shared/formatting/format-date-pipe.ts`) | Grouped by what it is for, not what it is |
| Directive that injects a feature store | `features/<feature>/<name>.ts` | Injecting a feature store makes it that feature's |
| `provide*()` function | feature-scoped → `features/<feature>/`; app-scoped → `core/<topic>/` | Only `app.config.ts`, `*.routes.ts`, and route components call them |
| Test fixture or fake | `src/testing/<topic>.ts` | Outside the app graph; may import anything |

## Routes, chunks, and store scope

- **`app.routes.ts` is the only eager route table.** The primary landing page is its one eager component; every other feature is reached through `loadComponent` or `loadChildren`. Guards and matchers come from `core/`; query params arrive as `input()` through `withComponentInputBinding()`. Other eager exceptions (a sign-in callback, the failure pages) are listed in the table, never implied.
- **The initial graph is what `main.ts`, `app.*`, `core/**`, and the landing feature statically import.** Nothing under another feature may be imported from there. An optional initial-chunk gate (`references/enforcement.md`) fails the build when it happens.
- **A route's `providers:` lists the stores and `provide*()` calls reached only from its chunk.** State that belongs to one feature is provided on that feature's route, not at the root, so its lifetime ends with the feature; a root-provided class only a lazy feature imports still lands in that feature's chunk, but its state outlives the screen.
- **One store per entity type.** Root stores in `core/<topic>/`; feature stores in their feature; a store's lifetime is decided by `providedIn` or `providers:`, never by its folder. Compose the shared `with-*` features, and a reset feature that snapshots state at construction **last**, so no state-contributing feature after it survives the reset.
- **Cross-store coordination goes through `core/events/`.** A component never subscribes to `Events`; the store does, in `withEventHandlers`.

## Styling and layout

- **Design system first.** Reach for the design system's components and utilities before writing CSS: its grid and flex utilities for layout, its spacing and typography scales, its cards, lists, alerts, badges, placeholders, spinners, and tables. Interactive widgets come from the design system's Angular integration as standalone directives and services, never from a global JavaScript bundle; where it has none, use Angular Aria (`angular-standards`).
- **Custom CSS is the exception.** A component stylesheet holds only what utilities cannot express, reads the theme's CSS custom properties rather than hex values, and stays inside the `anyComponentStyle` budget. Global styles are partials, `src/styles/_<topic>.scss`, pulled in with `@use`. CSS only a lazy feature needs ships as a non-injected style bundle (`inject: false` plus a `bundleName` in `angular.json`) that the feature loads, because every global stylesheet counts against the initial budget.
- **Mobile-first.** Lay a screen out for about 360 px, then add breakpoint utilities for wider screens. No fixed pixel widths on layout containers; full-height layouts use `100dvh`; tables and code blocks scroll inside their container instead of widening the page; interactive targets meet WCAG 2.2's 24×24 px minimum. A panel that is a sidebar on large screens becomes an off-canvas drawer on small ones rather than a second layout. Check every screen at 360, 768, and 1280 px in every theme.
- **The palette only through theme tokens.** Colours come from the theme the global stylesheet configures; a new colour joins that palette block and is never inlined in a component or template. Every text and background pair meets WCAG AA in every theme, and a component that bakes in the primary colour gets its dark-theme override when the app first uses it.
- **Third-party design systems are themed, not adopted.** A library that ships its own look is restyled in one global partial that maps its CSS custom properties onto the theme's tokens and follows the theme switch. Its utility classes never appear in our templates, and our markup rendered inside it carries an isolating wrapper class the same partial defines.
- Icons are inline icon-font or SVG elements with `aria-hidden="true"` beside visible or visually-hidden text.
- Bootstrap 5.3 + ng-bootstrap specifics: `references/bootstrap.md`.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| `references/enforcement.md` | Adding or changing the ESLint layer bans, a top-level folder, a feature, or a path alias; a "Crosses a layer boundary" lint error; setting up an initial-chunk gate |
| `references/bootstrap.md` | The workspace uses Bootstrap 5.3 / ng-bootstrap and you are writing styles, theming, restyling a third-party kit, or choosing a widget |
