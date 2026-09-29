# ADR-001: Ship the Standards as the `andes` Plugin Marketplace

**Status**: Accepted — verified on Claude Code; GitHub Copilot checks pending ([checklist](#not-yet-verified-github-copilot-checklist))
**Amended by**: [2026-09-copilot-harness-and-release.md](2026-09-copilot-harness-and-release.md) (2026-09-27), [2026-09-notification-and-link-hooks.md](2026-09-notification-and-link-hooks.md) (2026-09-29), [2026-09-harness-trees.md](2026-09-harness-trees.md) (2026-09-29: the §1 layout is replaced by one tree per harness)
**Date**: 2026-09-26
**Deciders**: Rodrigo Rojas
**Supersedes in part**: [2026-08-effort-defaults.md](2026-08-effort-defaults.md), [2026-08-repo-audit.md](2026-08-repo-audit.md), [2026-08-prd-workflow.md](2026-08-prd-workflow.md), [2026-08-standards-refresh.md](2026-08-standards-refresh.md)
**Pre-plugin layout**: commit `97943de` on `main`

The manifests, `AGENTS.md`, and `scripts/repo-audit.mjs` are the source of truth. This record explains why they look the way they do. If a value here disagrees with a file, trust the file.

## Amendments (2026-09-27)

[ADR-002](2026-09-copilot-harness-and-release.md) supersedes the points below. The rest of this record stands as written.

- **§1 (and the `andes-init` VS Code settings in §2) — VS Code as a Copilot client.** VS Code is no longer a target. Copilot agents declare `target: github-copilot` (Copilot CLI, the coding agent, github.com), carry no `handoffs`, `argument-hint`, or `vscode/*` tools, and `andes-init` no longer offers `chat.plugins.*` or `chat.useAgentsMdFile`.
- **§4 — the planner.** `andes-planner-expert` now invokes `andes-prd-generator` when a feature has no PRD and its requirements are unclear, writes the plan to `docs/plans/`, and ends with `**Recommended agent**` / `**Next step**` lines instead of handoffs. The PRD generator never hands off to the planner.
- **§6 — MCP versions and owners.** `context7` moved from `andes-dotnet` to `andes-core` as a remote, anonymous HTTP server (`https://mcp.context7.com/mcp`, no pin). `angular-cli` runs `@angular/cli@latest` on purpose instead of resolving the project-local CLI.
- **§9 — "Maintainer-only commands … stay in `.claude/commands/` and `.github/prompts/`".** They are skills in `.claude/skills/` now (`/repo-audit`, `/ngrx-signals-sync`, and the new `/release`); both folders are deleted.
- **Copilot checklist.** Items 2 and 8 (VS Code) are void. Items 1 and 3–7 remain open.

## Context

Until this change the repository held two hand-mirrored drop-in trees: `.claude/` for Claude Code and `.github/` for GitHub Copilot. Consumers copied one or both into their repositories. That model had four problems:

- **Duplication.** Every skill (79 files) existed twice, every path-scoped rule had an instruction twin, and 5 Claude agents shadowed 11 Copilot agents. An audit script existed only to catch the drift this caused, and it kept finding some.
- **No update path.** A copied tree never updates. Fixes reached consumers only if someone re-copied by hand.
- **Always-on cost.** `CLAUDE.md` (1,263 words) and `copilot-instructions.md` (995 words) loaded every session. Every `*.cs` edit auto-loaded four rules (about 2,566 words), whether or not the change touched an API, a Function, or an MCP server.
- **All-or-nothing.** An Angular-only repo still carried the .NET rules, and the other way around.

Both harnesses now support plugins, installed from marketplaces and cached by version. Both also read a root `AGENTS.md`. Plugins cannot ship `AGENTS.md`, path-scoped rules, or settings. The design below works around those three limits.

## Decision

### 1. One directory per plugin serves both harnesses

The repository is the `andes` marketplace (`.claude-plugin/marketplace.json`). It has six plugins:

| Plugin | Skills | Agents (both harnesses) | Copilot-only agents | MCP | Depends on |
| --- | --- | --- | --- | --- | --- |
| `andes-core` | `andes-init`, `prd`, `technical-writing` | `andes-prd-generator`, `andes-se-technical-writer` | `andes-planner-expert`, `andes-full-stack-expert` | — | — |
| `andes-dotnet` | `csharp-standards`, `aspnet-rest-apis`, `azure-functions-csharp`, `csharp-mcp-server`, `csharp-async`, `csharp-docs`, `csharp-xunit`, `ef-core`, `microsoft-agent-framework`, `microsoft-docs` | `andes-csharp-code-reviewer` | `andes-csharp-expert`, `andes-csharp-dotnet-janitor` | `microsoft-learn`, `context7` | `andes-core` |
| `andes-dotnet-wasm` | `blazor-wasm` | — | — | — | `andes-core`, `andes-dotnet` |
| `andes-angular` | `angular-developer` (vendored), `angular-standards` (new), `ngrx-signal-store` | `andes-angular-code-reviewer` | `andes-angular-expert` | `angular-cli` | `andes-core` |
| `andes-github` | `github-actions-hardening`, `github-actions-efficiency`, `github-actions-runtime-upgrade-conventions` | `andes-github-actions-reviewer` | — | — | `andes-core` |
| `andes-terraform` | `terraform-conventions` | — | — | `terraform` | `andes-core` |

Each plugin has this layout:

```text
plugins/andes-<name>/
├── .claude-plugin/plugin.json   # Claude Code manifest: lists each claude-agents/ file (directory paths are rejected)
├── plugin.json                  # Copilot manifest (Agent Plugins 1.0): $schema + metadata only
├── skills/                      # shared by both harnesses
├── claude-agents/               # Claude Code agents (*.md)
├── com.github.copilot/agents/   # Copilot agents (*.agent.md)
├── .mcp.json                    # Claude Code MCP servers (optional)
└── mcp.json                     # Copilot MCP servers, Agent Plugins format (optional; same servers)
```

**Copilot uses Agent Plugins 1.0.** The root `plugin.json` declares `"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"` and carries only metadata (name, version, description, author, homepage, repository, license, keywords). The spec fixes where components live — `skills/`, `mcp.json`, and client-specific files under `com.github.copilot/` — so the manifest has no path fields. Both Copilot clients document this format:

- VS Code: "A root plugin.json that declares the canonical Agent Plugins $schema uses Agent Plugins semantics."
- Copilot CLI: Agent Plugins 1.0 requires the manifest at the plugin root, reads custom agents from `com.github.copilot/agents/`, and reads MCP servers from a root `mcp.json` with `$schema` `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`.

A first iteration used the legacy `.github/plugin/plugin.json` manifest, but VS Code's format detection does not list that path and would have fallen back to the Claude manifest, loading the Claude agents — so it was dropped.

**Each harness reads only its own agents.** Claude Code loads only the `claude-agents/` files listed in `.claude-plugin/plugin.json`. Copilot reads custom agents only from the `com.github.copilot/` namespace, which other clients ignore by spec. Neither is a default `agents/` folder, so neither harness picks up the other's files. The audit rejects default-named `agents/`, `commands/`, and `hooks/` folders, a `.github/` folder inside a plugin, a missing or wrong `$schema`, and component path fields in the Agent Plugins manifest. Hooks follow the same rule: they live in `claude-hooks/`, declared in `.claude-plugin/plugin.json`, and in `com.github.copilot/hooks/` ([2026-09-notification-and-link-hooks.md](2026-09-notification-and-link-hooks.md)).

**Dependencies are Claude-only.** Agent Plugins 1.0 has no `dependencies` field. Claude Code resolves them from `.claude-plugin/plugin.json`; Copilot users install `andes-core` (and `andes-dotnet` before `andes-dotnet-wasm`) explicitly.

Every plugin starts at `1.0.0`. Both manifests of a plugin must bump `version` together on every change, because installs are cached by version.

### 2. The always-on standards live in a shared `AGENTS.md` block

The core standards are a 505-word block between `<!-- andes:begin vX -->` and `<!-- andes:end -->` markers. The block covers communication and comments, a file-type → skill routing table, the review loop, and docs/changelog/PRD delegation. It replaces the old always-on files (1,263 and 995 words).

Where each harness reads it:

- **Claude Code** (≥ 2.1.277) reads `AGENTS.md` natively, but only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists. One personal `CLAUDE.local.md` silently turns native loading off (verified). So the root `CLAUDE.md` is exactly `@AGENTS.md`. The import works either way and never loads the file twice.
- **Copilot** (CLI, cloud agent, and github.com code review) reads `AGENTS.md`. We deleted `.github/copilot-instructions.md`, because Copilot would load both files.

Plugins cannot ship `AGENTS.md`, so the user-invoked `andes-init` skill installs it in consumer repos. It:

- writes or refreshes the block from `plugins/andes-core/skills/andes-init/assets/agents-block.md` and never touches text outside the markers
- adds the `@AGENTS.md` import to `CLAUDE.md`
- detects which stacks the repo uses
- offers opt-in settings one at a time: the marketplace and `enabledPlugins`, a `permissions.deny` for the Angular CLI `ai_tutor` tool, `effortLevel: xhigh`, and the VS Code `chat.useAgentsMdFile` / `chat.plugins.*` settings
- offers to delete old drop-in copies, and deletes only after a yes

The block in this repo's own `AGENTS.md` must match the template byte for byte. The audit checks this.

### 3. Path-scoped rules became on-demand skills

Plugins cannot ship rules, so each rule became a skill with a trigger-style description. `csharp` became `csharp-standards`, `terraform` became `terraform-conventions`, and the other rules kept their names. A new `angular-standards` skill holds the Angular non-negotiables that used to live only in `CLAUDE.md` and the Copilot expert. A `.cs` edit now auto-loads nothing. The model loads only the skills the change needs.

Skill descriptions alone are not enough, because Claude Code limits the skill listing to about 1% of context. When the listing overflows, it drops the descriptions of rarely used skills. A headless session confirmed this: most `andes` skills showed by name only. The model still loaded `csharp-standards` and `csharp-xunit`, because the `AGENTS.md` routing table names them by file type. That table is why routing does not depend on descriptions surviving.

### 4. Claude Code implements in the main session; Copilot keeps implementer agents

On Claude Code, the main agent writes code and delegates only review, docs, and PRDs. There are no expert agents. Copilot keeps its implementer agents:

- `andes-csharp-expert` (it absorbs the old `csharp-mcp-expert`)
- `andes-angular-expert`
- `andes-csharp-dotnet-janitor`
- `andes-planner-expert`
- `andes-full-stack-expert`

### 5. Reviewers only report, and the review loop is bounded

- **Severities.** Reviewers report only **High** and **Medium** findings, plus one verdict line. Critical folds into High. Low and Info are dropped.
- **No edits, no hand-backs.** Reviewers have no handoffs, no `agents:`, and no edit or Agent tools. Claude reviewers also list `Write, Edit, NotebookEdit, Agent` in `disallowedTools`.
- **The loop.** The implementer fixes the findings, then re-reviews only the changed files, once. Two rounds maximum, then stop and surface what is left. The writer runs only after a passing verdict.
- **Full-stack.** `andes-full-stack-expert` now counts rounds per side. Before, a side could reach four rounds.
- **Copilot copies.** Copilot subagents do not receive `AGENTS.md`. The `## Review loop` section is copied word for word into the four Copilot implementers, and the audit enforces the match.

### 6. MCP grants are exact, and servers ship with plugins

- **Exact grants.** Every agent lists exact MCP tools, never a whole server.
  - Claude names tools `mcp__plugin_<plugin>_<server>__<tool>`.
  - Copilot agents use `server/tool`.
- **Angular CLI.**
  - `angular-cli` runs with `--read-only`, which drops the `run_target` and devserver tools.
  - `ai_tutor` has no server flag to remove it. No agent is ever granted it, and `andes-init` offers a deny rule for Claude's main session.
  - `find_examples` exists only on Angular CLI 21. It is granted anyway, because unknown tool names are ignored.
- **Versions.**
  - `context7` is pinned to `4.1.1`, and the Terraform image to `hashicorp/terraform-mcp-server:1.3.0` with `--toolsets=registry`.
  - `angular-cli` stays unpinned on purpose. `npx` then resolves the project-local CLI, so the tool set matches the consumer's Angular version.
- **One server list per harness.** A plugin with servers ships two files that list the same servers:
  - `.mcp.json` for Claude Code, where `microsoft-learn` is `type: http`.
  - `mcp.json` for Copilot, holding only `$schema` and `mcpServers`. Here `microsoft-learn` is `type: streamable-http`; the stdio servers are identical.

  The audit fails if the two files drift (`mcp/harness-drift`) or if `mcp.json` is missing (`mcp/copilot-missing`).
- **No root configs.** The root `.mcp.json` and `.vscode/mcp.json` are removed. Each plugin starts its own servers.

### 7. Agent names are `andes-<role>` everywhere

In both harnesses, every agent is named `andes-<role>`: lowercase, and equal to its file stem. In Claude Code, plugin agents appear as `andes-<plugin>:andes-<role>`.

### 8. One .NET testing policy

- **Libraries.** xUnit v3 and NSubstitute only, with xUnit `Assert`. Never FluentAssertions, AwesomeAssertions, Shouldly, Moq, FakeItEasy, NUnit, or MSTest.
- **Test databases.** Try Testcontainers first, then SQLite in-memory, then a dedicated physical test database. EF Core InMemory is the last resort.
- **Existing suites.** New tests follow the policy, and no banned package gets added. Existing tests are migrated only on request.

`ef-core` no longer recommends InMemory for unit tests or mocking `DbSet`.

### 9. Effort and maintenance

- **Effort.**
  - Reviewers keep `effort: xhigh`.
  - `andes-prd-generator` and `andes-se-technical-writer` drop to `high`.
  - The main-session `effortLevel: xhigh` is now an opt-in that `andes-init` offers, because plugins cannot ship settings.
- **Audit.** `scripts/repo-audit.mjs` was rewritten. Its checks are `manifests` (including the `--base` version-bump check), `skills`, `harness-paths`, `agents`, `mcp`, `memory`, `testing-policy`, `registry`, and `changelog`. Exit codes stay `0` / `10` / `1`.
- **CI.** `.github/workflows/repo-audit.yml` runs on PRs and on pushes to `main`:
  - Audit errors fail the job. Warnings stay advisory.
  - `claude plugin validate --strict` runs on the marketplace and on each plugin.
  - Actions are SHA-pinned and kept current by Dependabot.
- **Maintainer-only commands.** `/ngrx-signals-sync` and `/repo-audit` stay in `.claude/commands/` and `.github/prompts/`. They are not shipped in any plugin.

## Consequences

**Positive:**

- **One copy.** Each skill exists once. The skill-mirror and rule-parity checks are gone.
- **Real updates.** Consumers get fixes with `/plugin update` or a marketplace refresh instead of re-copying files.
- **Pick your stacks.** Install only the plugins you use. `andes-init` detects which ones apply.
- **Less always-on text.** It drops from 1,263 words to 505 words, and a `.cs` edit no longer loads about 2,566 words of rules.
- **Tighter permissions.** Reviewers cannot edit, and MCP access is exact per agent.

**Negative:**

- **Breaking change for current consumers.** Agent names change, rules become skills, and `copilot-instructions.md` and the root MCP configs go away. Consumers must install the plugins and run `andes-init`.
- **Skills load on demand.** A standard now applies only if the model loads its skill. The routing table reduces that risk but does not remove it, the way path-scoped rules did.
- **Copilot is unverified.** The Copilot side has not been tested end to end yet (see the checklist below).
- **Version bumps.** Every change needs a bump in two manifests. CI enforces it on PRs.
- **Two MCP files.** Plugins with MCP servers keep `.mcp.json` and `mcp.json` in step. The audit catches drift.
- **Manual dependencies on Copilot.** Agent Plugins 1.0 has no `dependencies` field, so Copilot users install `andes-core` (and `andes-dotnet` for `andes-dotnet-wasm`) themselves.
- **The `ai_tutor` deny is manual.** It depends on the consumer accepting `andes-init`'s offer.

**Neutral:**

- **Twins stay.** Agent twins still exist, but only for the five roles both harnesses share. Copilot keeps five implementer-only agents.
- **Upstream pin.** `angular-developer` stays byte-identical to upstream and hash-pinned in `scripts/upstream-skills.lock.json`.

## Alternatives Considered

**Keep the drop-in trees.**

- Pros: No new tooling, and consumers already know it.
- Cons: Every problem in [Context](#context) remains.

**Sibling plugin trees (`plugins/claude/*` + `plugins/copilot/*`).**

- Pros: Each tree has one manifest, so harness selection is never ambiguous.
- Cons: Skills are duplicated again, and the mirror audit comes back.
- Kept as the fallback if a Copilot client still loads the Claude manifest or agents.

**Keep `.github/copilot-instructions.md` next to `AGENTS.md`.**

- Pros: Nothing changes for current Copilot users.
- Cons: Copilot loads both files, so the standards load twice.

**One monolithic plugin.**

- Pros: One install.
- Cons: Every repo pays every stack's listing cost, and the unused skills crowd the listing budget.

## Verification Results (Claude Code 2.1.283)

Run in the cloud container:

- **Validation.** `claude plugin validate --strict` passes for the marketplace and all six plugins.
- **Install.** A local-marketplace install resolves `dependencies`.
- **Agents.**
  - Agents load as `andes-<plugin>:andes-<role>`, and only from `claude-agents/`.
  - `skills:` preloads work by bare name across plugins.
- **MCP.**
  - Plugin MCP tools are named `mcp__plugin_<plugin>_<server>__<tool>`.
  - An agent `tools:` allowlist hides `ai_tutor`, and unknown tool names are ignored.
- **`andes-init`**, run in a sandbox repo:
  - It appended the block and kept the existing notes.
  - It created the `CLAUDE.md` stub even though a `CLAUDE.local.md` existed.
  - A second run changed nothing.
- **Behavior eval** (task: "add tests for a C# service"):
  - The model loaded `csharp-standards` and `csharp-xunit`.
  - It wrote xUnit v3 + NSubstitute tests with no banned libraries.
  - It ran `andes-csharp-code-reviewer` (verdict: Approve), then the writer.

## Cost Numbers

| Measure | Before (`97943de`) | After |
| --- | --- | --- |
| Always-on standards | `CLAUDE.md` 1,263 words / `copilot-instructions.md` 995 words | `AGENTS.md` block 505 words (audit budget 700) |
| Auto-loaded on a `.cs` edit (Claude Code) | 4 rules, about 2,566 words | 0 — skills load on demand |
| Skill description budget | — | 400 characters (audit warning) |

Always-on listing cost per plugin (`claude plugin details`, tokens):

| Plugin | Tokens |
| --- | --- |
| `andes-core` | ~301 |
| `andes-dotnet` | ~963 |
| `andes-dotnet-wasm` | ~126 |
| `andes-angular` | ~364 |
| `andes-github` | ~278 |
| `andes-terraform` | ~98 |
| **All six** | **~2,130** |

## Not Yet Verified: GitHub Copilot Checklist

Copilot CLI and VS Code were not available in the verification environment. Run these locally, in order. Notes marked *Docs:* are expectations from GitHub and VS Code documentation fetched on 2026-09-26, not observed results.

Both manifest checks (1 and 2) now follow a documented, unambiguous path: each client selects Agent Plugins 1.0 from the root `plugin.json` `$schema`. They carry less risk than the earlier legacy-manifest design, but they are still the first thing to confirm. Copilot has no `dependencies` support in Agent Plugins 1.0, so install `andes-core` (and `andes-dotnet` before `andes-dotnet-wasm`) explicitly throughout.

1. **Copilot CLI uses the root Agent Plugins manifest and loads only `com.github.copilot/agents/`.**
   - Steps: `copilot plugin marketplace add RorroRojas3/awesome-claude-copilot`, then `copilot plugin install andes-core@andes` and `copilot plugin install andes-dotnet@andes`. Start a session and open `/agent`.
   - Pass: you see `andes-csharp-expert`, `andes-csharp-dotnet-janitor`, and `andes-csharp-code-reviewer` exactly once, with no Claude-format duplicates.
   - *Docs:* "The exact `$schema` value `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` opts a plugin into Agent Plugins 1.0 semantics." Custom agents are read from `com.github.copilot/agents/`.
2. **VS Code detects Agent Plugins 1.0 (not Claude format) and shows only the Copilot agents.**
   - Steps: set `chat.plugins.enabled` and add the repo to `chat.plugins.marketplaces`. Install `andes-core` and `andes-dotnet` from the Extensions view (`@agentPlugins`). Check the agents dropdown.
   - Pass: only the `com.github.copilot/agents/` agents appear, and none of the `claude-agents/` files do.
   - *Docs:* "A root plugin.json that declares the canonical Agent Plugins $schema uses Agent Plugins semantics." VS Code reads custom agents from the `com.github.copilot` namespace.
3. **`.claude-plugin/marketplace.json` is enough for marketplace discovery.**
   - Steps: run `copilot plugin marketplace browse andes`. In VS Code, search `@agentPlugins`.
   - Pass: all six plugins are listed.
   - *Docs:* Copilot CLI checks `.claude-plugin/marketplace.json` last in its marketplace lookup order.
4. **Agent IDs and `agents:` resolve across plugins.**
   - Steps: install `andes-core`, `andes-dotnet`, and `andes-angular`. Ask `andes-csharp-expert` for a small change.
   - Pass: it invokes `andes-csharp-code-reviewer` (from `andes-dotnet`) and `andes-se-technical-writer` (from `andes-core`) by bare name, with no plugin prefix.
   - *Docs:* the agent ID is the file name without `.agent.md`.
5. **Plugin MCP servers start from `mcp.json`, and tool IDs use `server/tool`.**
   - Steps: in an Angular workspace, run `andes-angular-code-reviewer`. In a .NET repo, run `andes-csharp-expert`.
   - Pass: `angular-cli/get_best_practices` and `microsoft-learn/microsoft_docs_search` (a `streamable-http` server) are callable. If they are missing, the plugin-server ID format differs.
6. **Plugin skills load from Copilot agents.**
   - Steps: ask `andes-csharp-expert` to add tests for a service.
   - Pass: it loads `csharp-standards` and `csharp-xunit`, and writes xUnit v3 + NSubstitute tests.
7. **Instructions load once in Copilot CLI.**
   - Steps: in a repo with `AGENTS.md` and the `@AGENTS.md` stub in `CLAUDE.md`, inspect the loaded instructions.
   - Pass: the `andes` block appears once. The stub adds at most its one literal line.
8. **The `chat.useAgentsMdFile` default in VS Code.**
   - Steps: record the default value. Confirm that `AGENTS.md` appears in a chat response's references. (`andes-init` offers to set it to `true` explicitly anyway.)

Also open:

- **Node version.** Angular CLI 22.2 requires Node ≥ 22.22.3 for the `angular-cli` MCP server.
- **NgRx drift check.** The check could not reach `api.github.com` from the container. Run `/ngrx-signals-sync --check-only` locally.

## Fallbacks If Copilot Checks Fail

| Failing check | Fallback |
| --- | --- |
| 1, 2 — a Copilot client loads the Claude manifest or agents | Sibling trees `plugins/claude/andes-*` and `plugins/copilot/andes-*`, each with one manifest. `skills/` stays byte-identical, and the audit enforces it. |
| 3 — marketplace not found | Add a root `marketplace.json`, which is first in Copilot CLI's marketplace lookup order. |
| 4 — `agents:` targets don't resolve across plugins | Use the plugin-qualified ID Copilot reports in `agents:` and `handoffs`, and update the audit's target check to match. |
| 5 — tool IDs differ for plugin servers | Adjust the `server/tool` entries in the Copilot agents' `tools:` to the format Copilot reports. |

## References

- Claude Code plugins and marketplaces: <https://code.claude.com/docs/en/plugin-marketplaces>
- Agent Plugins 1.0 specification: <https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md>
- Copilot CLI plugin reference (Agent Plugins 1.0 manifest, `com.github.copilot/` components, marketplace lookup order, precedence): <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- Copilot CLI, finding and installing plugins: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing>
- VS Code agent plugins (format detection, `chat.plugins.marketplaces`): <https://code.visualstudio.com/docs/agent-customization/agent-plugins>
- Branch history: `git log --oneline 97943de..HEAD` on `claude/agent-architecture-plan-vmfbnd`
