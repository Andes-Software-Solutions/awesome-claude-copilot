# Scaffold `<name>-ui/`

These are the order of work and the commands. Load `angular-standards` and `angular-ui-architecture` before you start. The folder rules, names, and lint come from the skills each step names. Confirm every CLI flag and schematic option for the current Angular version through the `angular-cli` MCP server. All paths below are relative to `<name>-ui/`.

## 1. Workspace

1. From the repository root: `npx @angular/cli@latest new <name>-ui --style scss --routing --skip-git`. Add `--ssr false` if the installed CLI still asks about it. The repository is already a git repo, so the CLI must not create a nested one.
2. Keep the CLI's default file naming: pin no naming option in `angular.json` (`angular-ui-architecture` `references/enforcement.md`, "File naming").
3. Add the path aliases to `tsconfig.json` exactly as `references/enforcement.md` lists them, with no `baseUrl`.

## 2. The `src/app/` skeleton

Create the feature-first folders from `angular-ui-architecture`:

```text
src/app/
├── core/
│   ├── api/                  wire DTOs, *.model.ts
│   ├── config/
│   └── navigation/           route-paths.ts
├── features/home/            home.ts / .html / .scss — the landing page
├── shared/
├── app.ts  app.config.ts  app.routes.ts
src/testing/
```

- `app.routes.ts` is the only eager table. It loads the landing page eagerly (`component: Home`, from `@features/home/home`), and its paths come from `core/navigation/route-paths.ts`.
- `app.config.ts` provides `provideRouter` with `withComponentInputBinding()`. Zoneless change detection and `HttpClient` need no provider on current versions; add `provideHttpClient(withInterceptors([...]))` with the first interceptor.
- Put a `.gitkeep` in each folder that has no file yet, so the layout is visible before the first feature lands.

## 3. Lint and state

- `npx ng add angular-eslint`, then copy `assets/eslint-layer-bans.js` from the `angular-ui-architecture` skill beside `eslint.config.js` and spread it in as `references/enforcement.md` describes.
- `npx ng add @ngrx/signals`, and add the `signalsTypeChecked` rules scoped to `**/*.ts` (`ngrx-signal-store`). Scaffold no store until a feature needs one.

## 4. Design system

- **Bootstrap 5.3 + ng-bootstrap** (the default): follow `angular-ui-architecture` `references/bootstrap.md`. Install with `npx ng add @ng-bootstrap/ng-bootstrap`, then remove the root `NgbModule` import and replace its Sass `@import` as that reference says; compile Bootstrap from Sass in `src/styles.scss`; add Bootstrap Icons; set light and dark themes on `data-bs-theme`.
- **None:** keep `src/styles.scss` with the theme tokens as CSS custom properties, and add `src/styles/_<topic>.scss` partials as they are needed.

## 5. Talking to the API (when both parts are scaffolded)

- Add `proxy.conf.json` mapping `/api` to the `https` URL in `<name>-api/<Root>.Api/Properties/launchSettings.json` (`"secure": false` for the dev certificate), and reference it from the `serve` target in `angular.json`.
- Components and stores call relative `/api/...` URLs. The base URL for other environments lives in `core/config/`, never in a component.

## 6. Tests

- Keep the test runner that `ng new` configured (Vitest on current versions, `angular-standards`); `TestBed` is zoneless by default.
- Write one spec, `features/home/home.spec.ts`, that renders the landing page, so `ng test` proves the setup.
