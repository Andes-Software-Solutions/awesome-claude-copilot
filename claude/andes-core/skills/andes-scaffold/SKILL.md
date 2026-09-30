---
name: andes-scaffold
description: "Scaffold a new Andes project at the repository root: `<name>-api/` (a .NET 10 Minimal API solution with Api, Service, Repository, Entity, Dto, and Common projects plus unit and integration tests, the global exception handler and SQL persistence wired) and/or `<name>-ui/` (an Angular workspace with the kind-first src/app layout, path aliases, and layer lint). Run on request only."
---

# andes-scaffold

Run only when the user asks to scaffold, create, or start a new API and/or UI project (for example `/andes-core:andes-scaffold` in Claude Code or `/andes-scaffold` in Copilot CLI). Never start it on your own, and never run it over an existing project.

The skill creates one folder per part at the repository root, named after the project:

```text
<repo>/
├─ <name>-api/     .NET solution — references/api.md
└─ <name>-ui/      Angular workspace — references/ui.md
```

For example, the name `andes` gives `andes-api/` and `andes-ui/`. The two reference files are in this skill's own directory; resolve them relative to this `SKILL.md`, not the user's repo. They hold the order of work and the commands. The code and the folder trees stay in the stack skills they name, and those skills are the ones to load and follow.

## 1. Ask

Ask everything in one message and show the defaults:

1. **Project name**, in kebab-case (`andes`, `contoso-shop`). This name sets the folder names.
2. **Parts:** `api`, `ui`, or `both`.
3. **api only:**
   - `<Root>`, the solution prefix. By default, derive it from the name: `andes` → `Andes`, `contoso-shop` → `Contoso.Shop`.
   - `<Prefix>`, the one product word on infrastructure DI methods and the DbContext. By default, use the PascalCase name: `Andes` → `AddAndes…`, `AndesDbContext`.
   - The store. Default: `Sql` (SQL Server).
4. **ui only:** the design system. Default: Bootstrap 5.3 + ng-bootstrap. The other choice is none.

## 2. Check before writing anything

Work from `git rev-parse --show-toplevel`. Stop and report if any of these fails:

- `<name>-api/` or `<name>-ui/` already exists and is not empty.
- **api:** `dotnet --version` reports a .NET 10 SDK or later, and the `dotnet-api-architecture` skill is available. If the skill is missing, the `andes-dotnet` plugin is not installed: say so, skip the api, and name the install command.
- **ui:** `node --version` and `npx --version` work, and the `angular-ui-architecture` skill is available. If the skill is missing, the `andes-angular` plugin is not installed: say so and skip the ui.

## 3. Scaffold

For `api`, follow `references/api.md`. For `ui`, follow `references/ui.md`. For `both`, do the api first, because the ui's dev proxy needs the Api's URL.

Ground every command flag and package version in the MCP servers (`microsoft-learn` for .NET, `angular-cli` for Angular, `context7` for anything else) and in NuGet or npm, never in memory.

## 4. Verify

- **api**, in `<name>-api/`: `dotnet build` with no warnings, `dotnet test`, and `dotnet format --verify-no-changes`.
- **ui**, in `<name>-ui/`: `npx ng build`, `npx ng lint`, and `npx ng test --watch=false`.

Fix what fails before you report. A scaffold that does not build is not done.

## 5. Finish

- Run the Review loop from `AGENTS.md` on the generated code: `andes-csharp-code-reviewer` for the api and `andes-angular-code-reviewer` for the ui.
- If `AGENTS.md` has no andes block, suggest `andes-init`. If it has the `## Layout` and `## Build/test/run` sections, offer to fill them in for the new folders. Edit only outside the andes markers, and only on a yes.
- Report the folders created, the verification results, anything skipped and why, and the next step. The first feature goes through the normal flow (`dotnet-api-architecture` decision table, `angular-ui-architecture` placement table). The scaffold ships no sample feature.
