# Architecture skills: `dotnet-api-architecture` and `angular-ui-architecture`

**Date:** 2026-09-28. **Status:** accepted. Extends [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) §3 (path-scoped rules became on-demand skills).

## Why

Two path-scoped rules in a consumer repository, `api-architecture.md` (263 lines) and `ui-architecture.md` (127 lines), fixed where every file goes and what it is called in a layered .NET minimal-API solution and in an Angular `src/app/` workspace. They were written to be portable — placeholders, no repository names — but they lived in one repository and auto-loaded on every `.cs` or `src/app/**` edit, about 11k tokens, whether or not the change touched layout.

Plugins cannot ship rules, so they became skills, the same move ADR-001 made for the other rules. The always-on block routes to them by trigger, not by file type, because a layout skill is needed only when a change adds, moves, renames, or registers something.

## What shipped

| Plugin | Version | Skill | Loaded when |
| --- | --- | --- | --- |
| `andes-dotnet` | 1.2.0 | `dotnet-api-architecture` | a change adds, moves, renames, or registers files, folders, or projects in an `Api → Service → Repository → Entity → Common` (+ `Dto`) solution |
| `andes-angular` | 1.2.0 | `angular-ui-architecture` | a change adds, moves, or names files under `src/app/`, registers a route or path alias, or wires the ESLint layer bans |
| `andes-core` | 1.2.0 | block `v1.2.0` | the two routing rows above; `andes-init` offers to delete the old rule files |

**Progressive disclosure.** Each `SKILL.md` answers the common question — where does this go, what is it called — on its own: layering, the rules that apply everywhere, a compact solution map, the decision or placement table, and the "never" list. The heavy material is read on demand from `references/`:

- `dotnet-api-architecture`: `project-layout.md` (the eight trees), `naming.md` (naming table, the three file-name exceptions, the `.editorconfig` lines that enforce namespace == folder), `options-and-validation.md` (binding chain, validator registration, why the built-in minimal-API validation is not registered), `persistence.md` (what a provider folder owns, EF placement, exception translation, adding a second store).
- `angular-ui-architecture`: `enforcement.md` (the ban table, ESLint wiring and its traps, path aliases, the optional initial-chunk gate), `bootstrap.md` (Bootstrap 5.3 + ng-bootstrap specifics), and `assets/eslint-layer-bans.js`, an exported function that generates the `no-restricted-imports` blocks from the workspace's `components/` and `pages/` folders.

**Agents.** The C# and Angular reviewers, both twins, load the skill when the diff adds, moves, or renames files and report placement or naming violations as Medium. The Copilot experts, the janitor, and the planner name it in their load lists. Nothing preloads it: a preload would cost the reviewer 5-7k tokens on every run.

## Decisions

1. **EF mapping stays fluent-only.** `ef-core` (edited 2026-09-27) maps everything in `IEntityTypeConfiguration<T>` and puts no mapping attributes on entities. The source rule's hybrid split (attributes for column shape, fluent for the rest) was dropped from the skill, so `<Root>.Entity` takes no EF Core package at all and every mapping lives in `Repository/<Provider>/Configurations/`.
2. **Test layout is two projects per solution.** `csharp-xunit` now prescribes `tests/<Root>.Unit.Test` and `tests/<Root>.Integration.Test` with folders mirroring the source projects and `TestInfrastructure/` at each root, replacing one test project per production project. Existing suites are migrated only on request.
3. **Styling is design-system-agnostic in the body.** `angular-standards` names no design system, so the skill's styling section states the portable rules (utilities before CSS, theme tokens only, mobile-first at 360 / 768 / 1280 px, WCAG 2.2 targets, third-party kits themed not adopted) and `references/bootstrap.md` holds the Bootstrap 5.3 instance.
4. **Scalar only.** `aspnet-rest-apis` allowed "Scalar or Swagger UI"; it now renders with Scalar and bans `Swashbuckle.AspNetCore`, matching the rule.
5. **One type per file, with named exceptions.** `csharp-standards` defers to the three groupings the skill defines: a folder's records, structs, constants, or exceptions in one `<Folder>…` file; an interface with its single implementation; a validator with the type it validates.
6. **Handler visibility follows `aspnet-rest-apis`** (`private static`); the rule's `internal static` was dropped rather than restated.

## Fixes made while porting

- The source used `<RootShort>DbContext` without defining `<RootShort>`; the skill uses `<Prefix>DbContext`.
- The source both required an `Exceptions/` folder in every throwing project and banned one in Service; the skill groups exceptions in `<Folder>Exceptions.cs` beside the code that throws them and keeps `Service/Exceptions/` as the only folder.
- The source named both a form component and its policy file `<name>-form.ts`; the component is `<name>-dialog.ts`, the policy file `<name>-form.ts`.
- `references/enforcement.md` says plainly that `no-restricted-imports` matches the import string, not the resolved path, so a relative import without an `app/` segment escapes the ban, and names the `eslint-plugin-import` rules that close the gap.
- `naming.md` notes that plural enum names collide with CA1717 when that analyzer is enabled, and that IDE0130 reaches the build only with `EnforceCodeStyleInBuild`.
- Repository-specific text (a chat kit's wrapper class, an AG-UI transport class, the palette names, a `check:initial-chunk` script's page list) was generalized or described as a pattern.

## Cost

| Measure | Value | Budget |
| --- | --- | --- |
| `dotnet-api-architecture` description | 386 characters | 400 |
| `angular-ui-architecture` description | 392 characters | 400 |
| Always-on block | 573 words (`v1.1.0`: 551) | 700 |
| `dotnet-api-architecture` load | `SKILL.md` about 110 lines; four references read on demand | — |
| `angular-ui-architecture` load | `SKILL.md` about 100 lines; two references and one asset read on demand | — |

## Consumer follow-up

A repository that still carries `.claude/rules/api-architecture.md` or `ui-architecture.md` loads the same guidance twice once the bumped plugins are installed. `andes-init` lists both files under old drop-in copies and offers to delete them.
