<!-- andes:begin v1.5.0 -->
# Andes engineering standards

Shared by Claude Code and GitHub Copilot. The `andes-init` skill manages this block and replaces it on refresh — put project-specific instructions after the `andes:end` marker (`andes-init` scaffolds those sections on first install).

## Communication & comments

- Lead with the answer or the change; no preamble, no restating the request. Don't re-summarize what the user already saw — report only what changed or went wrong. Match length to substance.
- Comment only what code cannot say: why a decision was made, constraints, non-obvious invariants, workarounds with links. Never narrate what code does or what changed. XML doc comments on public APIs are API documentation, not comments.

## Load the standards before you edit

Detailed standards live in skills that load on demand. Load the matching skill before writing or reviewing code:

| Working on | Load |
| --- | --- |
| Any `*.cs` | `csharp-standards`, plus `aspnet-rest-apis` (web APIs), `azure-functions-csharp` (Functions), `csharp-mcp-server` (MCP servers), `ef-core` (EF Core; `ef-core-base-entities` / `ef-core-enum-reference-tables` for entities and lookup tables), `csharp-async`, `csharp-docs` (public APIs) as the change needs; `dotnet-api-architecture` when adding, moving, renaming, or registering files, folders, or projects. Non-negotiables: Minimal APIs only (no controllers), FluentValidation only (no DataAnnotations), services query the `DbContext` directly (no repositories), primary constructors, collection expressions, `var`, and the `csharp-standards` file layout |
| .NET tests | `csharp-xunit` — xUnit v3 + NSubstitute only; never FluentAssertions, Shouldly, Moq, NUnit, or MSTest. Test databases: Testcontainers → SQLite in-memory → dedicated test database → EF Core InMemory as a last resort |
| `*.razor`, `*.razor.cs` | `blazor-wasm` |
| Angular code | `angular-standards`; `ngrx-signal-store` for any state; `angular-ui-architecture` when adding, moving, or naming files or wiring layer lint; `angular-developer` references for depth |
| `*.tf` | `terraform-conventions` |
| `.github/workflows/*.yml`, `action.yml` | `github-actions-hardening`, plus `github-actions-efficiency` / `github-actions-runtime-upgrade-conventions` when relevant |
| Microsoft Agent Framework | `microsoft-agent-framework` |

Ground version-specific answers in the MCP servers when they are installed — `microsoft-learn` (.NET, Azure), `angular-cli` (Angular), `context7` (any other library; ships with `andes-core`), `terraform` (providers, modules) — instead of memory.

## Review loop

After changing code, run the matching reviewer on the diff: `andes-csharp-code-reviewer` (C#, including Blazor), `andes-angular-code-reviewer` (Angular), `andes-github-actions-reviewer` (workflows, composite actions). Terraform has no reviewer — run `terraform fmt -check` and `terraform validate` instead.

1. Reviewers report only High and Medium findings plus a verdict. They never edit files or hand work back.
2. The implementer fixes every reported finding, then runs the reviewer once more on only the files changed since round 1.
3. Two rounds maximum. If High findings remain after round 2, stop and report them to the user instead of iterating; list any open Medium findings in the final summary.
4. After a passing verdict (**Approve** or **Approve with changes**), invoke `andes-se-technical-writer` to update `docs/` and add the `CHANGELOG.md` entry — unless your caller said it handles documentation.

## Docs, changelog & requirements

- `andes-se-technical-writer` owns `docs/` and the root `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)): one reader-facing entry per PR under `## [Unreleased]` in the matching subsection. Routine cleanups with no behavior change still get a one-line entry.
- To write a PRD, spec a feature, or break it into epics and user stories, delegate to `andes-prd-generator` (writes `docs/prd/`). If its report starts `PRD-STATUS: NEEDS-INPUT`, show its questions to the user verbatim and re-invoke it with the answers. It creates GitHub issues only after the user explicitly approves. PRDs and the implementation plans under `docs/plans/` get no changelog entry; plans reference story IDs (`US-xxx`). Plans are working files for following the implementation: never commit `docs/plans/`; keep it in `.gitignore`.
- When `andes-azure-devops` is installed, delegate creating, updating, or removing Azure DevOps epics, features, and stories (including from a PRD) to `andes-ado-backlog-manager`. It previews every change and always asks who to assign and which iteration; if its report starts `ADO-STATUS: NEEDS-INPUT` or `ADO-STATUS: NEEDS-SETUP`, show it to the user verbatim and re-invoke it with the answers and the user's explicit approval.
<!-- andes:end -->

## About this repository

This repository is the `andes` plugin marketplace: engineering standards for C#/.NET, Angular, GitHub Actions, and Terraform, plus Azure DevOps backlog management, packaged as plugins for Claude Code and GitHub Copilot (Copilot CLI, coding agent, github.com; the agents also load in VS Code, which is unverified). It holds no application code, only assistant configuration: skills, agents, MCP server declarations, and the always-on block above, which is also what `andes-init` installs in consumer repositories.

## Layout

- `.claude-plugin/marketplace.json` — the Claude Code marketplace. `.github/plugin/marketplace.json` — the Copilot marketplace, which Copilot CLI and VS Code read first. Both are named `andes` and list the same seven plugins.
- `claude/andes-<name>/` — what Claude Code loads: `.claude-plugin/plugin.json` (metadata and dependencies, no component keys), `agents/`, `hooks/hooks.json`, `.mcp.json`, and the editing copies of `skills/` and `scripts/`.
- `copilot/andes-<name>/` — what Copilot loads: the Agent Plugins 1.0 root `plugin.json`, `mcp.json`, `com.github.copilot/agents/`, `com.github.copilot/hooks/hooks.json`, and mirrors of `skills/` and `scripts/`.
- `claude/andes-core/scripts/` — `notify.mjs`, the script both harnesses' notification hooks run (Node built-ins only).
- `claude/andes-core/skills/andes-init/assets/` — `agents-block.md` (the block above) and `project-section.md` (the scaffold for sections like these).
- `.claude/skills/` — maintainer-only skills `/repo-audit`, `/ngrx-signals-sync`, `/release`; read by Claude Code and Copilot CLI, not shipped in any plugin.
- `scripts/` — `repo-audit.mjs` (structural audit), `check-links.mjs` (the Markdown link checker the audit's `links` check uses), `sync-shared.mjs` (mirrors `skills/` and `scripts/` between the trees), `release.mjs` (release), `upstream-skills.lock.json` (hash pin for the vendored `angular-developer` skill), `tests/` (`node:test` suites for the hook script and the link checker, run per tree by `run.mjs`).
- `docs/` — dated design records. `CHANGELOG.md` — Keep a Changelog, rolled by `/release`.
- `.github/workflows/repo-audit.yml` — CI: the audit, `claude plugin validate --strict`, and the hook-script tests on every PR.
- `.mcp.json` — the MCP servers maintainers query for current docs and backlog data: `microsoft-learn`, `angular-cli`, `context7`, `azure-devops` (needs `ADO_ORG` and `az login`), and `terraform` (needs Docker). Each entry is a verbatim copy of the plugin that ships it; the audit fails on drift (`mcp/root-drift`).

## Working conventions

- This repository builds the marketplace and is maintained with Claude Code. It never registers the `andes` marketplace or enables its plugins in `.claude/settings.json` (`registry/self-install`); load live plugin files with `--plugin-dir` instead (Commands). Ground skill and agent changes in the root `.mcp.json` servers, not in memory. Change a server's pin in its plugin first, then copy the entry into `.mcp.json`.
- Each harness loads only its own tree. VS Code hands one plugin folder to several harnesses, so no folder holds both formats (`isolation/*`; `docs/2026-09-harness-trees.md`). Never add a root `marketplace.json` or `.plugin/marketplace.json`: Copilot would read it before its own.
- Edit skills and hook scripts under `claude/`, then run `node scripts/sync-shared.mjs`; the copies under `copilot/` must match (`mirror/*`). Agents are never mirrored.
- A Claude agent and its Copilot twin change together; their descriptions match apart from the word PROACTIVELY. Copilot agents declare no `target`, so they load in both VS Code and `github-copilot`; they pin `model` as a `modelParity` pair, CLI slug first and VS Code display name second (`[claude-sonnet-5.5, Claude Sonnet 5.5 (copilot)]`), pin `reasoning-effort` to the `copilotEffort` table in `scripts/repo-audit.mjs`, use only the plain tool aliases and exact `server/tool` MCP grants, and carry no `argument-hint` or `vscode/*` tools. Only `andes-planner-expert` declares `handoffs`: VS Code Local sessions show them as buttons, and every other surface ignores them.
- All plugins share one version (`manifests/version-lockstep`). When any plugin changes, bump `version` in both manifests (`claude/<name>/.claude-plugin/plugin.json`, `copilot/<name>/plugin.json`) of every plugin, changed or not — installs are cached by version. CI enforces the bump with `--base`.
- Edit the block in `agents-block.md`, sync, then copy it verbatim between the markers above. Its `## Review loop` section is also copied verbatim into the Copilot implementer agents.
- Never edit either copy of `angular-developer` (vendored upstream, hash-pinned). Refresh `ngrx-signal-store` with `/ngrx-signals-sync`.
- No skill sets `disable-model-invocation: true` — it makes the skill unreachable on Copilot CLI (github/copilot-cli#4438); skills guard in their body instead.
- MCP servers are declared once per tree (`claude/<name>/.mcp.json`, `copilot/<name>/mcp.json`) with the same entries; Claude tool names carry the plugin that ships the server (`mcp__plugin_andes-core_context7__query-docs`).
- Hooks are declared once per tree too: `claude/andes-core/hooks/hooks.json` and `copilot/andes-core/com.github.copilot/hooks/hooks.json` run the same `scripts/*.mjs` for the one event pair, `Notification`/`notification` (`hooks/harness-drift`), and each passes its own `--harness` value. A hook script imports only `node:` built-ins, prints nothing on a Copilot `notification`, and exits 0 on its own errors.

## Commands

- `/repo-audit` — run before committing (`node scripts/repo-audit.mjs` plus `claude plugin validate .`); report-only unless `--fix`. Never commits.
- `node scripts/sync-shared.mjs` — mirror `skills/` and `scripts/` from `claude/` to `copilot/`; `--check` only reports, `--from=copilot` reverses it.
- `node scripts/tests/run.mjs` — the hook-script tests, once per tree.
- `/ngrx-signals-sync` — check the upstream NgRx docs and refresh the skill; leaves the diff for review.
- `/release <major|minor|patch>` — from a clean `main`: rolls `[Unreleased]`, tags `vX.Y.Z`, pushes, and publishes the GitHub Release. The only command that commits, and only after you confirm its dry run.
- Develop against live files with `claude --plugin-dir claude` (every plugin) or `claude --plugin-dir claude/andes-core --plugin-dir claude/andes-<name>`; a plugin loaded without its dependencies is skipped silently.
