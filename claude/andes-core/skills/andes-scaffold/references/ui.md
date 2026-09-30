# Scaffold `<name>-ui/`

These are the order of work and the commands. Load `angular-standards` and `angular-ui-architecture` before you start. The folder rules, names, and lint come from the skills each step names. Confirm every CLI flag and schematic option for the current Angular version through the `angular-cli` MCP server. All paths below are relative to `<name>-ui/`.

## 1. Workspace

1. From the repository root: `npx @angular/cli@latest new <name>-ui --style scss --routing --skip-git`. Add `--ssr false` and zoneless (`angular-standards`) if the installed CLI still asks about them. The repository is already a git repo, so the CLI must not create a nested one.
2. Pin the schematic naming options in `angular.json` so `ng generate` produces the suffixes and separators from `angular-ui-architecture` (`references/enforcement.md`, "Schematic naming").
3. Add the path aliases to `tsconfig.json` exactly as `references/enforcement.md` lists them, with no `baseUrl`.

## 2. The `src/app/` skeleton

Create the kind-first folders from `angular-ui-architecture`:

```text
src/app/
├── pages/home/               home.ts / .html / .scss — the first lazy page
├── components/
├── state/
├── services/
├── core/navigation/          route-paths.ts
├── shared/{components,directives,pipes,models,utils}/
├── app.ts  app.config.ts  app.routes.ts
src/testing/
```

- `app.routes.ts` is the only eager table. It reaches `pages/home/home.ts` through `loadComponent`, and its paths come from `core/navigation/route-paths.ts`.
- `app.config.ts` provides zoneless change detection, `provideRouter` with `withComponentInputBinding()`, and `provideHttpClient(withFetch())`.
- Put a `.gitkeep` in each folder that has no file yet. An empty kind folder is part of the layout and keeps its lint block.

## 3. Lint and state

- `npx ng add angular-eslint`, then copy `assets/eslint-layer-bans.js` from the `angular-ui-architecture` skill beside `eslint.config.js` and spread it in as `references/enforcement.md` describes.
- Install `@ngrx/signals` and add the `signalsTypeChecked` rules scoped to `**/*.ts` (`ngrx-signal-store`). Scaffold no store until a feature needs one.

## 4. Design system

- **Bootstrap 5.3 + ng-bootstrap** (the default): follow `angular-ui-architecture` `references/bootstrap.md`. Install with npm, not `ng add`; compile Bootstrap from Sass in `src/styles.scss`; add Bootstrap Icons; set light and dark themes on `data-bs-theme`.
- **None:** keep `src/styles.scss` with the theme tokens as CSS custom properties, and add `src/styles/_<topic>.scss` partials as they are needed.

## 5. Talking to the API (when both parts are scaffolded)

- Add `proxy.conf.json` mapping `/api` to the `https` URL in `<name>-api/<Root>.Api/Properties/launchSettings.json` (`"secure": false` for the dev certificate), and reference it from the `serve` target in `angular.json`.
- Components and stores call relative `/api/...` URLs. The base URL for other environments lives in `core/config/`, never in a component.

## 6. Tests

- Keep the test runner that `ng new` configured (Vitest on current versions, `angular-standards`), with `provideZonelessChangeDetection()` in `TestBed`.
- Write one spec for `pages/home/home.ts` that renders the page, so `ng test` proves the setup.
