# Angular standards follow Angular's own rules; feature-first layout

**Date:** 2026-10-22. **Status:** accepted. Supersedes the Angular parts of [2026-09-architecture-skills.md](2026-09-architecture-skills.md): the kind-first folders, the file suffixes, and the path aliases of `angular-ui-architecture`. Everything else in that record (the `dotnet-api-architecture` skill, progressive disclosure, the cost budgets) still holds.

## Why

The Andes Angular skills had drifted from Angular. `angular-ui-architecture` prescribed kind-first folders (`pages/`, `components/<feature>/`, `state/`, `services/`) and dot suffixes (`.guard.ts`, `.resolver.ts`, `.token.ts`), pinned in `angular.json` so `ng generate` would match. The angular.dev style guide says the opposite: "organize by feature areas … avoid creating directories like components, directives, and services". Other rules had aged too: OnPush is the default on v22, `@Service()` replaces `@Injectable({ providedIn: 'root' })` for new singletons, and `httpResource` reads server data without a store.

A standard that contradicts the framework costs twice. Developers who follow Angular's docs break our rules, and our rules fight the CLI's output. Two NgRx skill claims were also wrong in practice (see [Fixes](#fixes-in-ngrx-signal-store)).

## Decision

Andes follows Angular. When sources disagree, the higher one wins:

1. **angular.dev**: the style guide, the version's best practices (`get_best_practices`), and the guides.
2. **The CLI's default output**: what `ng generate` produces with no naming overrides.
3. **The vendored `angular-developer` skill**: the `references/` file matching the work.
4. **Andes add-ons**, only where the sources above are silent: `angular-standards`, `ngrx-signal-store`, and `angular-ui-architecture` (folders, names, path aliases, layer lint).

An Andes rule that contradicts a higher source is a bug: follow Angular and report it. The list is at the top of `angular-standards/SKILL.md`, which the always-on block already routes to for any Angular work.

## What changed

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-angular` | 1.16.0 | Precedence list; `angular-standards` non-negotiables updated and version-gated; `angular-ui-architecture` rewritten feature-first (breaking); `angular-developer` re-vendored; `ngrx-signal-store` fixes; reviewer and expert agents aligned |
| `andes-core` | 1.16.0 | `andes-scaffold` produces the feature-first skeleton; block marker `v1.16.0` |
| All others | 1.16.0 | Version lockstep only |
| Repository | 1.16.0 | `scripts/upstream-skills.lock.json` re-pinned for `angular-developer` |

### `angular-ui-architecture`: feature-first layout (breaking)

The kind-first tree is replaced by three top-level folders:

```text
src/app/
├── core/<topic>/          app-wide singletons by topic: auth/, api/, config/, errors/, events/, layout/ …
├── features/<feature>/    everything one feature owns, flat; sub-folders by area, never by kind
├── shared/<theme>/        reusable pieces with no business logic: empty-state/, formatting/, dates/ …
└── app.ts  app.config.ts  app.routes.ts
src/testing/               fakes, fixtures, shared test providers (@testing/*)
```

| | Before | After |
| --- | --- | --- |
| Top-level folders | `pages/ components/<f>/ state/ services/ core/ shared/{components,directives,pipes,models,utils}` | `core/<topic>/ features/<feature>/ shared/<theme>/` |
| Component, directive, service files | Components suffix-free; services `-service.ts` / `-client.ts` | No suffix; services named for intent (`chat-data.ts`) |
| Guard, interceptor, resolver | `.guard.ts`, `.interceptor.ts`, `.resolver.ts` | `-guard.ts`, `-interceptor.ts`, `-resolver.ts` |
| Pipe | Under `shared/pipes/` | `-pipe.ts` (`shared/formatting/format-date-pipe.ts`) |
| Token | `.token.ts` | `-token.ts` |
| Stores | `-store.ts` | `-store.ts` (unchanged) |
| Dots kept | `.routes.ts`, `.model.ts`, `.spec.ts`, `.config.ts` | Same |
| `angular.json` naming | Schematic options pinned | Nothing pinned; the CLI's defaults are the convention |
| Path aliases | `@pages @components @state @services @core @shared @testing` | `@core @features @shared @testing` |
| Primary landing page | Lazy like every route | Eager (`component:` in `app.routes.ts`), per Angular's guidance |

`assets/eslint-layer-bans.js` was rewritten for the new rules:

- Features never import each other.
- `core` never imports `features`.
- `shared` imports only `shared` and `core/**/*.model.ts`.
- `*.model.ts` files import no `@angular/*`, `@ngrx/*`, or app code other than other models.
- Per-feature blocks are generated from the folders under `features/`. The "models only" exceptions use ESLint `regex` patterns, so the config needs ESLint 9.7 or later.

`references/bootstrap.md` now installs ng-bootstrap with `ng add @ng-bootstrap/ng-bootstrap`, as Angular requires for libraries, and then undoes two things the schematic writes: the root `NgbModule` import and the Sass `@import 'bootstrap/scss/bootstrap'` in `src/styles.scss` (replaced by the skill's `@use`).

### `angular-standards`: non-negotiables

Rules now track current Angular and name the version where behavior differs:

| Topic | Rule |
| --- | --- |
| Change detection | v22+: OnPush is the default, so set nothing; a component `ng update` marked `Eager` stays until moved deliberately. Below v22: set `OnPush` |
| Singletons | `@Service()` on v22+; `@Injectable({ providedIn: 'root' })` below |
| Forms | Signal Forms for new forms on v22+ (was v21+) |
| HTTP | `httpResource` for read-only server reads on v22+; `provideHttpClient` only to configure features (v21+ injects `HttpClient` without it) |
| Components | `protected` members the template reads, `readonly` on inputs/outputs/queries |
| Templates | No `ngClass`, `ngStyle`, or `CommonModule`; `@defer` never above the fold |
| SSR | `DOCUMENT` token instead of the global `document` |
| Styling | No `::ng-deep`; native `animate.enter` / `animate.leave` |
| Tooling | `ng add` for Angular libraries |
| Tests | `TestBed` is zoneless by default on v21+ |

### `angular-developer`: re-vendored

Re-vendored from `github.com/angular/skills` HEAD with `npx skills add`: 19 files changed and 6 new references (`deferrable-views`, `http-client`, `naming-conventions`, `pipes`, `queries-and-projection`, `server-side-rendering`). It is re-pinned in `scripts/upstream-skills.lock.json`. Neither copy is edited locally.

Upstream's new `angular-new-app` skill is **deliberately not vendored**. `andes-scaffold` owns new projects, and `angular-new-app` runs `ng new --ai-config`, which writes AI configuration files that `andes-init` owns.

### Fixes in `ngrx-signal-store`

No NgRx docs drift: the skill stays pinned at `@ngrx/signals` 22.0.1 and was not re-pinned.

- **Decision rule.** Read-only server state uses `httpResource`, with a new section on `httpResource` inside `withProps`. A `withEntities` collection that the store also mutates loads with `rxMethod` and `setAllEntities`.
- **`'reloading'` claim fixed.** A reload keeps the previous value; the skill said it did not.
- **`fakeAsync` suggestion removed.** It contradicted the zoneless testing rule.
- **Examples follow the new naming**: `books-store.ts`, `with-request-status.ts`, `BooksData`, `book.model.ts`, `protected` template fields, no explicit OnPush, and errors stored in state instead of `console.error`.

### Other skills and agents

- **`andes-scaffold` (`references/ui.md`)** generates the feature-first skeleton, an eager `features/home/`, and installs `@ngrx/signals` and ng-bootstrap with `ng add`. The skill description says "feature-first".
- **Agents.** The `andes-angular-code-reviewer` checklist (Claude and Copilot twins) and the Copilot `andes-angular-expert` intro match the new precedence and layout.

## Alternatives considered

**Keep the kind-first layout and document it as an Andes add-on.** Rejected. The precedence rule makes this a bug by definition: the style guide names the type-of-code directories as the thing to avoid, and the CLI's defaults already produce the dash suffixes. Keeping our own layout would also require pinning schematic options in every consumer's `angular.json` forever. It does have a real advantage, which we give up: all stores or all pages are findable in one folder. In a feature-first tree a feature's pieces sit together instead, and cross-feature sharing becomes an explicit promotion to `shared/` or `core/`.

**Vendor `angular-new-app` too.** Rejected, as above: `andes-scaffold` already owns new projects.

## Migration guide: consumer repository on the kind-first layout

The change is breaking only for a repository that adopts the new skill text on an existing workspace. An existing workspace keeps its style until you decide to move it; the skill says so, and an agent working in a kind-first repository follows that repository's conventions.

1. **Move one feature at a time.** For feature `chat`, merge `pages/chat/`, `components/chat/`, `state/chat/`, and the feature-owned part of `services/` into `features/chat/`. State root-provided across features goes to `core/<topic>/`; reusable components, directives, pipes, and pure functions go to `shared/<theme>/`; wire DTOs from `shared/models/` go to `core/api/<resource>.model.ts`, and a type one feature uses goes beside its consumer as `<name>.model.ts`.
2. **Never mix styles in one folder.** Finish a feature before starting the next. A feature folder is either all new-style or untouched.
3. **Rename the dot suffixes to the CLI's dash form** as each feature moves: `auth.guard.ts` to `auth-guard.ts`, `chat.resolver.ts` to `chat-resolver.ts`, `auth.interceptor.ts` to `auth-interceptor.ts`; `chat.token.ts` to `chat-token.ts`; a pipe to `-pipe.ts`; and `-service.ts` to an intent name (`chat-service.ts` to `chat-data.ts`). Keep `.routes.ts`, `.model.ts`, `.spec.ts`, and `.config.ts`. Update the class names if they carried the old suffix. Remove any pinned `schematics` naming options from `angular.json` after the last feature moves.
4. **Swap the aliases.** In `tsconfig.json` replace `@pages/* @components/* @state/* @services/*` with `@features/*`, keep `@core/*`, `@shared/*`, and `@testing/*`, and rewrite the imports. Run `ng build` after each feature.
5. **Replace `eslint-layer-bans.js`.** Copy the new `assets/eslint-layer-bans.js` over the old one, spread its blocks in `eslint.config.js` as before, and upgrade ESLint to 9.7 or later if needed. Fix the new violations; most are cross-feature imports that need promoting to `shared/` or `core/`.
6. **Make the landing page eager** and keep every other route lazy: move the primary landing route to `component:` in `app.routes.ts`.
7. **Run `ng build` and `ng test --watch=false`.** Update the initial-chunk gate's `lazyRoots` list, if you use one, to the feature paths.

Do the standards updates (OnPush default, `@Service()`, Signal Forms) separately: they depend on the workspace's Angular version, not on the layout.

## Consequences

- **Consumers move at their own pace.** Nothing changes in an existing repository until someone follows the migration guide. New code in a kind-first repository stays kind-first (see the last rule of the skill).
- **ESLint 9.7 or later** is required for the new layer bans (`regex` patterns in `no-restricted-imports`). Older configs keep the old file until upgraded.
- **One audit warning stays.** Upstream's `angular-developer` description is now 472 characters, so `skills/description-budget` prints one warning (budget 400). We cannot fix it locally because the folder is hash-pinned and must not be edited. CI does not run the audit with `--strict`, so it does not fail.
- **Fewer rules of our own.** The add-on layer is smaller and defers to angular.dev, so most future Angular releases need a re-vendor and a version-gate edit, not a rewrite.
- **Reviewer findings change.** The Angular reviewer gains a placement and naming check (a type folder, a cross-feature import, a name that is not the CLI default in a feature that uses them) and version-gated checks for OnPush, `@Service()`, and `httpResource`.

## Verified

- `node scripts/repo-audit.mjs`: 0 errors, 1 warning (`skills/description-budget` on `angular-developer`).
- No NgRx docs drift against `@ngrx/signals` 22.0.1.

## Not verified

- A consumer repository migrated end to end with the new `eslint-layer-bans.js`.
- `ng add @ng-bootstrap/ng-bootstrap` output on every supported Angular version: the two undo steps assume the schematic writes the root `NgbModule` and the Sass `@import`.
