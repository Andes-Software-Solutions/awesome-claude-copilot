# ADR-002: Target the `github-copilot` Harness, C# Non-negotiables, and Releases

**Status**: Accepted — verified by the audit and on Claude Code; Copilot CLI end-to-end checks still pending ([open items](#verification-results))
**Date**: 2026-09-27
**Deciders**: Rodrigo Rojas
**Amends**: [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md)
**Superseded in part by**: [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md) (2026-09-29) — the Copilot agents no longer declare `target`, so they load in VS Code too. The bans on `argument-hint` and `vscode/*` tools stand. [2026-09-planner-handoffs.md](2026-09-planner-handoffs.md) (2026-09-29) gives `andes-planner-expert` handoff buttons for VS Code Local sessions. Every other agent still carries no `handoffs`.

The agent files, manifests, skills, `AGENTS.md`, `scripts/repo-audit.mjs`, and `scripts/release.mjs` are the source of truth. This record explains why they look the way they do. If a value here disagrees with a file, trust the file.

## Context

ADR-001 shipped the marketplace one day earlier and left the Copilot side unverified. Reading GitHub's custom-agent and Copilot CLI documentation against our own files, and reviewing the C# the standards produced, surfaced seven problems:

- **The Copilot agents were written in VS Code's dialect.** GitHub's configuration reference defines `target` as `vscode` or `github-copilot`, and documents `handoffs` and `argument-hint` as unsupported on the cloud agent (Copilot CLI, the coding agent, github.com). Our agents carried handoff buttons, `vscode/askQuestions` and `vscode/memory` tools, and `execute/<sub>` tool-set ids. VS Code is the one Copilot surface we do not run the standards on, and supporting it doubled the frontmatter to verify.
- **The PRD flow ran backwards on Copilot.** `andes-prd-generator` handed off to `andes-planner-expert` and carried `disable-model-invocation: true`, which GitHub documents as blocking subagent invocation. The planner could not call it, so a feature without a PRD needed the user to drive two agents by hand. The Claude twin already used the `PRD-STATUS` report contract.
- **Context7 lived in the wrong plugin.** It shipped with `andes-dotnet`, pinned to `4.1.1` as an npx server. The `andes-core` agents (planner, PRD generator, writer) and the Angular expert had no way to ground a library outside .NET, and every Context7 release meant a pin bump.
- **The Angular CLI MCP tool set depended on the consumer's CLI.** ADR-001 left `@angular/cli` unpinned so `npx` would resolve the project-local CLI. The server's tool set changes with the CLI version (`find_examples` arrived in 21), so an older workspace silently hid tools the agents are granted.
- **Generated C# still drifted.** Controllers, DataAnnotations, ad-hoc member order, spelled-out local types, and `_logger.LogInformation(...)` kept appearing. The standards said "prefer", and the reviewers had no severities for them.
- **Maintainer commands existed twice, and one copy never loaded.** `/repo-audit` and `/ngrx-signals-sync` were `.claude/commands/*.md` for Claude Code and `.github/prompts/*.prompt.md` for Copilot. Copilot CLI does not load prompt files at all (GitHub's customization cheat sheet; copilot-cli#618 was closed as superseded by skills). Skills in `.claude/skills/` load on both.
- **There was no release.** Plugin versions move per PR, but nothing tagged the marketplace, published a GitHub Release, or rolled the CHANGELOG. `[Unreleased]` still held everything tag `v1.0.0` had shipped on 2026-08-07.

## Decision

### 1. Copilot agents target `github-copilot` only

VS Code (local Copilot) is dropped as a surface. The standards plan, implement, review, and document autonomously, which is the cloud agent's job, and one target means one frontmatter shape to verify.

- Every `plugins/*/com.github.copilot/agents/*.agent.md` declares `target: github-copilot`.
- `handoffs`, `argument-hint`, `vscode/*` tools, and `execute/<sub>` tool-set ids are removed. Tools are the seven aliases GitHub documents — `read`, `edit`, `search`, `execute`, `agent`, `web`, `todo` — plus exact `server/tool` MCP grants.
- `andes-init` no longer offers `.vscode/settings.json` (`chat.plugins.*`, `chat.useAgentsMdFile`).
- The README has a "Not supported: VS Code" section: do not add the marketplace to `chat.plugins.marketplaces` or install from the `@agentPlugins` view.
- The audit enforces it: `agents/target`, `vscode-key`, `vscode-tool`, and `alias-subtool` (§9).

### 2. The planner invokes the PRD generator, never the reverse

A plan needs requirements first, and only one of the two agents can be the other's subagent. The planner is the entry point the user runs; the PRD generator is the specialist it calls.

`andes-prd-generator` (Copilot):

- lost its planner handoff and its `disable-model-invocation: true`, so the planner can invoke it
- adopted the Claude twin's report contract: the first line is `PRD-STATUS: NEEDS-INPUT`, `DRAFTED`, or `ISSUES-CREATED`; at most 5 questions, each with a default, one round-trip
- invokes no other agent
- the twins' descriptions now match apart from the word PROACTIVELY (`description-parity`, §9)

`andes-planner-expert`:

- keeps `disable-model-invocation: true` — the user runs it, nothing calls it
- has `agents: ["andes-prd-generator"]` and the `agent` tool
- gained a **Requirements check** step: search `docs/prd/`; if the request is a feature with no PRD and its users, scope, or success criteria are unclear, invoke the PRD generator in draft mode with "do not create issues"; relay a `NEEDS-INPUT` report's questions verbatim, then re-invoke it once with the answers
- reports `PLAN-STATUS: NEEDS-INPUT` or `PLAN-STATUS: PLANNED` on its first line; at most 3 numbered questions per round, each with a default, one round-trip
- writes the plan to `docs/plans/<yyyy-mm-dd>-<slug>.md` — its only writable path — and presents the same plan in the reply. Plans, like PRDs, get no changelog entry
- ends with `**Recommended agent**` and `**Next step**` lines instead of handoff buttons. Copilot CLI has no shared session between agents, so the plan file is the handoff
- carries an MCP grounding table — .NET and Azure → `microsoft-learn`, Angular and NgRx → `angular-cli`, any other library → Context7 — and names the tool used next to each version-dependent decision

### 3. Context7 ships with `andes-core`, remote and anonymous

Every research agent needs a documentation source for libraries outside .NET and Angular, and `andes-core` is the one plugin every consumer installs.

- `plugins/andes-core/.mcp.json` declares `context7` as `type: http` at `https://mcp.context7.com/mcp`; `mcp.json` declares the same URL as `type: streamable-http`. No API key: the anonymous rate limit is enough for agent use, and there is no secret to distribute.
- It is removed from `andes-dotnet`, and it is no longer an npx pin.
- It is granted, as the exact tools `resolve-library-id` and `query-docs`, to `andes-planner-expert`, `andes-prd-generator`, `andes-se-technical-writer`, `andes-csharp-expert`, `andes-csharp-dotnet-janitor`, and `andes-angular-expert`. The Claude twins name it `mcp__plugin_andes-core_context7__<tool>`: the plugin segment is the plugin that ships the server (`mcp-owner`, §9).

### 4. The Angular CLI MCP server floats on `@latest`

The agents are granted a fixed tool set, so the server should expose it regardless of the workspace. `angular-cli` now runs `npx -y @angular/cli@latest mcp --read-only`. The `@latest` suffix is deliberate, and the audit requires exactly that suffix (`mcp/floating-suffix`) rather than a version pin. The `--read-only` flag and the `ai_tutor` handling from ADR-001 are unchanged.

### 5. C# non-negotiables

"Prefer" left too much room. `csharp-standards` now states rules that apply to every new or changed file, and the rest of the .NET surface echoes them instead of restating them: `aspnet-rest-apis`, `csharp-xunit`, `azure-functions-csharp`, `ef-core`, `blazor-wasm`, `csharp-docs`, `csharp-mcp-server`, both `andes-csharp-code-reviewer` twins, `andes-csharp-expert`, and `andes-csharp-dotnet-janitor`.

| Rule | Detail |
| --- | --- |
| Minimal APIs only | No MVC controllers, `[ApiController]`, `AddControllers()`, or `MapControllers()`; never `dotnet new webapi --use-controllers` |
| FluentValidation only | No DataAnnotations, no `AddValidation()`, no `[ValidatableType]` — also in Blazor forms (no `DataAnnotationsValidator`) and in EF Core entity mapping (fluent `IEntityTypeConfiguration<T>` only) |
| File layout | Fields, constants, and properties; interface implementations in the interface's order; then `#region Private methods`, `#region Public static methods`, `#region Logging` — in that order, always last, and a region exists only when it has members |
| Primary constructors | On every class that takes dependencies, captured into `private readonly` `_camelCase` fields |
| Collection expressions | `[]`, `[1, 2, 3]`, `[.. first, .. second]` — never `new List<T>()`, `new T[] { }`, or `Array.Empty<T>()` |
| `var` | Wherever the initializer has a type; spell the type out only for collection expressions, `default`, `null`, and lambdas |
| Logging | Only through `[LoggerMessage]` source-generated partial methods in the `Logging` region — never `_logger.LogInformation(...)` in a method body |
| Tests | xUnit v3, latest, on Microsoft Testing Platform — `dotnet new xunit3`, `<OutputType>Exe</OutputType>`, `<TestingPlatformDotnetTestSupport>true</TestingPlatformDotnetTestSupport>` — with NSubstitute only |

- **Scope.** New and changed code. Existing code is migrated only on request. Where a project convention conflicts, the non-negotiable wins for new code and the conflict is flagged.
- **Reviewers.** A new controller, DataAnnotations validation, or banned test library is **High**. File layout, `var`, region, and `[LoggerMessage]` violations are **Medium**. The standards are never nits.
- **StyleCop.** Repositories that run it disable SA1124 (regions), SA1202 (public before private), and SA1204 (static before instance) in `.editorconfig` instead of breaking the layout.
- **Exemptions.** `[McpServerToolType]` tool classes, which the MCP SDK requires to be static; Azure Functions `IActionResult` returns, which are the Functions HTTP result type and not MVC; records and DTOs with no methods; generated code.
- **Audit.** `csharp-policy/banned-pattern` fails when any plugin text or `AGENTS.md` recommends a banned pattern (§9).

### 6. Maintainer commands are skills

`.claude/commands/*.md` and `.github/prompts/*.prompt.md` are deleted. `/repo-audit`, `/ngrx-signals-sync`, and the new `/release` live in `.claude/skills/<name>/SKILL.md`. Claude Code reads that folder as project skills, and Copilot CLI scans `.github/skills`, `.claude/skills`, and `.agents/skills`, so each command exists once and loads on both. Prompt files never load in Copilot CLI.

No skill sets `disable-model-invocation: true`. Open bug github/copilot-cli#4438 makes such a skill unreachable on the CLI (reproduced through 1.0.87). `andes-init` dropped the flag and guards in its body instead ("Run only when the user asked for `andes-init`"); the three maintainer skills guard the same way. The audit enforces it for plugin skills (`skills/cli-unreachable`) and maintainer skills (`registry/maintainer-skill`).

### 7. Releases are a marketplace event

Plugin versions keep moving per PR, and CI's `repo-audit --base` check enforces the bump. A release is the marketplace-level event: it rolls the CHANGELOG, tags, and publishes. `scripts/release.mjs <major|minor|patch|X.Y.Z> [--dry-run]` does it with Node built-ins only:

1. **Preconditions** (exit `2` on failure): on `main`, clean tree, in sync with `origin/main`, `gh auth status` passes, `scripts/repo-audit.mjs` is clean, and `claude plugin validate .` passes when the `claude` CLI is on PATH (a warning otherwise — CI runs it on every PR).
2. **Version.** The next version comes from the highest `v*` tag (`v0.0.0` if none). An explicit `X.Y.Z` must be above it and must not exist yet.
3. **CHANGELOG.** `## [Unreleased]` moves under `## [X.Y.Z] - <date>`, and the Keep a Changelog compare links are rewritten: `[Unreleased]: …/compare/vX.Y.Z...HEAD` and `[X.Y.Z]: …/compare/<previous>...vX.Y.Z`. An empty `[Unreleased]` blocks the release.
4. **Git.** Commit `chore(release): vX.Y.Z`, annotated tag `vX.Y.Z`, `git push origin main --follow-tags`.
5. **GitHub Release.** `gh release create vX.Y.Z` with the released section plus a `### Plugin versions` table read from the Claude manifests. If this step fails after the push, the script keeps the notes file and prints the exact retry command; the tag already exists, so the release is never re-run from the start.

Exit codes: `0` released (or the dry run printed), `2` a precondition failed, `1` the script failed. The `/release` skill always dry-runs first and asks one yes/no question before the real run. It is the only maintainer command allowed to commit.

The CHANGELOG was backfilled to match: the entries that shipped in tag `v1.0.0` (2026-08-07) now sit under `## [1.0.0] - 2026-08-07`, with `[Unreleased]` above it and the link footer at the bottom.

### 8. `AGENTS.md` layout and the `andes-init` scaffold

The block is what every consumer loads; the sections after it belong to one repository. The root `AGENTS.md` is the andes block (marker `<!-- andes:begin v1.1.0 -->`) followed by **About this repository**, **Layout**, **Working conventions**, and **Commands**.

Block changes in `v1.1.0` (`plugins/andes-core/skills/andes-init/assets/agents-block.md`):

- the `*.cs` row lists the non-negotiables: Minimal APIs only, FluentValidation only, primary constructors, collection expressions, `var`, and the `csharp-standards` file layout
- the tests row says xUnit v3
- the MCP grounding line says `context7` "ships with `andes-core`"
- PRDs and the implementation plans under `docs/plans/` get no changelog entry

`andes-init` appends `assets/project-section.md` — placeholder **About this repository**, **Layout**, **Build, test, run**, and **Conventions** sections — when it creates `AGENTS.md`, and only then. A refresh never touches text outside the markers.

### 9. Audit rules

`scripts/repo-audit.mjs` gained the rules that make §1–§7 hold, and lost the ones that assumed VS Code or command twins.

Added:

| Rule | Catches |
| --- | --- |
| `agents/target` | A Copilot agent without `target: github-copilot` |
| `agents/vscode-key` | `handoffs:` or `argument-hint:` on a Copilot agent |
| `agents/vscode-tool` | A `vscode/*` tool |
| `agents/alias-subtool` | A tool-set member such as `execute/<sub>` instead of the plain alias |
| `agents/agent-tool-mismatch` | `agents:` without the `agent` tool, or the reverse |
| `agents/target-ghost`, `agents/target-not-invocable` | An `agents:` entry that is not a marketplace agent, or one that carries `disable-model-invocation: true` |
| `agents/description-parity` | Twin descriptions that differ beyond the word PROACTIVELY |
| `agents/required-mcp` | A research or implementer agent missing one of its required MCP grants (`requiredMcpGrants`); a Claude twin is checked through the plugin that ships the server. This is what guarantees the planner holds `microsoft-learn`, `angular-cli`, and `context7` |
| `agents/mcp-owner` | A Claude MCP tool name whose plugin segment is not the plugin that ships the server |
| `mcp/floating-suffix` | An `angular-cli` package without the `@latest` suffix |
| `mcp/harness-drift` | Now also compares `headers` and `env` between `.mcp.json` and `mcp.json` |
| `skills/cli-unreachable` | `disable-model-invocation: true` on a plugin skill |
| `csharp-policy/banned-pattern` | `[ApiController]`, `AddControllers(`, `MapControllers(`, `DataAnnotations`, or `--use-controllers` recommended in plugin text or `AGENTS.md`; lines phrased as prohibitions pass |
| `registry/legacy-commands` | A `.claude/commands/` or `.github/prompts/` folder |
| `registry/maintainer-skill` | A `.claude/skills/<name>` without `SKILL.md`, a `name` that differs from the folder, no description, `disable-model-invocation: true`, or a name that shadows a plugin skill (project skills win in Copilot CLI) |

Removed: `copilotBuiltinAgents`, `handoffTargets`, `reviewer-handoff`, and the command/prompt twin rules.

### 10. Versions and the NgRx sync

| Plugin | Version |
| --- | --- |
| `andes-core` | 1.1.0 |
| `andes-dotnet` | 1.1.0 |
| `andes-dotnet-wasm` | 1.0.1 |
| `andes-angular` | 1.1.0 |
| `andes-github` | 1.0.1 |
| `andes-terraform` | 1.0.0 (unchanged) |

`ngrx-signal-store` was re-pinned to `@ngrx/signals` 22.0.1. `SignalStoreFeatureType` was added to `references/custom-features.md` and `references/api-reference.md`; the API reference records the 22.0 `DeepSignal` change (a slice whose type is a union containing an object literal now yields a `DeepSignal` for the object member) and the `@angular/core ^22` peer. `delegatedSignal` (22.0) is deliberately not documented: no tracked upstream doc page covers it, and the sync propagates only what the pinned pages say.

## Consequences

**Positive:**

- **One Copilot surface.** Every Copilot agent has one frontmatter shape, and the audit can verify all of it.
- **The planner is self-sufficient.** A feature without a PRD gets one in the same run, and the plan file carries the handoff to the implementer.
- **Any library, any research agent.** Context7 is available wherever `andes-core` is installed, with nothing to pin and no key to distribute.
- **C# output converges.** The rules are stated once, echoed everywhere, and reviewed with severities. The audit refuses plugin text that recommends a banned pattern.
- **One copy of each maintainer command**, and it loads on both harnesses.
- **Releases are reproducible.** One command, dry-run first, with preconditions that refuse a dirty tree or the wrong branch.
- **The new rules bite.** Run against the previous commit, they reported 48 errors.

**Negative:**

- **VS Code users lose the plugins.** There is no supported way to run the standards in local Copilot.
- **C# codebases on controllers or DataAnnotations get findings.** New code in those repositories is held to Minimal APIs and FluentValidation, so mixed codebases exist until the team migrates on request.
- **Anonymous Context7 has a rate limit.** A busy session can hit it. The agents fall back to `web` for the page.
- **`@latest` is a moving target.** A new Angular CLI release can change the tool set or require a newer Node (Angular CLI 22.2 needs Node ≥ 22.22.3) without a change in this repository.
- **Two report contracts to keep by hand.** `PLAN-STATUS` and `PRD-STATUS` are prose contracts. The audit checks the frontmatter around them, not the wording.
- **Releases need local tooling.** `gh` must be logged in, and `claude plugin validate` is skipped when the CLI is missing locally; CI is the backstop.

**Neutral:**

- **Plugin versions and release versions are independent.** A release ships whatever plugin versions `main` holds and lists them in the notes.
- **Copilot end-to-end is still unverified.** ADR-001's checklist items 1 and 3–7 remain open; items 2 and 8 (VS Code) are void.
- **Skills guard in prose.** Until copilot-cli#4438 is fixed, "run only when the user asked" is a body instruction, not a flag.

## Alternatives Considered

**Keep VS Code as a target, with prompt-file twins for the commands.**

- Pros: Nothing changes for VS Code users, and handoff buttons are a good fit in an IDE.
- Cons: Two frontmatter dialects in one file, two copies of each maintainer command (one of which never loads in the CLI), and a second surface to verify that the standards were not designed around.

**Lockstep plugin versions equal to the release version.**

- Pros: One number to reason about.
- Cons: Every release invalidates every plugin cache, so consumers re-download plugins that did not change. Per-PR bumps already say what changed.

**Release through a PR and a CI tag job.**

- Pros: No local preconditions, and the release is reviewed like any change.
- Cons: A bot commit to `main`, a workflow with `contents: write`, and a second place that edits the CHANGELOG. The script keeps the write path in one pair of hands, behind an explicit yes.

**Planner replies with the plan only, no `docs/plans/`.**

- Pros: No files to clean up.
- Cons: Copilot CLI has no shared session between agents. Without a file, the implementer has nothing to read; the file is the handoff.

## Verification Results

Run locally on the feature branch on 2026-09-27:

- `node scripts/repo-audit.mjs --strict` and `node scripts/repo-audit.mjs --base=origin/main` exit `0`: 6 plugins, 21 skills, 5 Claude + 10 Copilot agents (5 twins), 0 warnings.
- The new rules, run against the previous commit in a throwaway worktree, reported 48 errors across the new ids.
- `node scripts/release.mjs patch --dry-run` on the feature branch exits `2` with "releases are cut from main".
- The NgRx drift check exits `0` at `@ngrx/signals` 22.0.1.
- The `claude` CLI was not on PATH locally, so `claude plugin validate --strict` was not run here. CI runs it on every PR.

Still open:

- **Copilot CLI end to end** — ADR-001 checklist items 1 and 3–7: manifest detection, marketplace discovery, cross-plugin `agents:`, plugin MCP servers and `server/tool` ids, plugin skills, and a single instruction load. Items 2 and 8 (VS Code) are void.

## References

- GitHub Copilot custom agents configuration reference (`target`, `handoffs`, `argument-hint`, tool aliases): <https://docs.github.com/en/copilot/reference/custom-agents-configuration>
- Copilot CLI, adding skills (`.github/skills`, `.claude/skills`, `.agents/skills`): <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills>
- Copilot customization cheat sheet (which files load where): <https://docs.github.com/en/copilot/reference/customization-cheat-sheet>
- github/copilot-cli#4438 — `disable-model-invocation: true` makes a skill unreachable: <https://github.com/github/copilot-cli/issues/4438>
- github/copilot-cli#618 — prompt files in the CLI, closed as superseded by skills: <https://github.com/github/copilot-cli/issues/618>
- Context7 MCP server (remote endpoint, anonymous access): <https://github.com/upstash/context7>
- xUnit v3 on Microsoft Testing Platform: <https://xunit.net/docs/getting-started/v3/microsoft-testing-platform>
- Keep a Changelog 1.1.0: <https://keepachangelog.com/en/1.1.0/>
- Branch history: `git log --oneline 3583cd5..HEAD` on `claude/agent-architecture-plan-vmfbnd`
