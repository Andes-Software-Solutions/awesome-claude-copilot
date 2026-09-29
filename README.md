# awesome-claude-copilot

[![Claude Code](https://img.shields.io/badge/Claude_Code-config-d97757?logo=claude&logoColor=white)](https://code.claude.com)
[![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-config-8957e5?logo=githubcopilot&logoColor=white)](https://github.com/features/copilot)
[![.NET](https://img.shields.io/badge/.NET-C%23_14-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![Angular](https://img.shields.io/badge/Angular-NgRx_Signals-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/RorroRojas3/awesome-claude-copilot/pulls)

This repository is the **`andes` plugin marketplace**. It packages engineering standards for C#/.NET, Angular, GitHub Actions, and Terraform, plus Azure DevOps backlog management, as plugins for [Claude Code](https://code.claude.com) and [GitHub Copilot](https://github.com/features/copilot) (Copilot CLI, Copilot coding agent, github.com, and VS Code). Each plugin lives in one directory that serves both harnesses. You install only the stacks you use, and updates arrive through the marketplace instead of by re-copying files.

It contains no application code, only assistant configuration: skills, agents, MCP servers, and a shared `AGENTS.md` block.

How it fits together:

- **A short always-on block.** An `AGENTS.md` block of about 640 words, installed by `andes-init`, is the only text loaded every session. Both harnesses read it. On a first install `andes-init` also scaffolds the project's own sections after it.
- **Standards load on demand.** The detailed standards are skills. A file-type → skill routing table in `AGENTS.md` tells the model which ones to load.
- **Reviewers only report.** They report High and Medium findings with a verdict. The review loop is capped at two rounds, and then the technical writer documents the change.
- **MCP servers ship with their plugin.** Each server is pinned (or floats on `@latest` by design) and scoped, every agent is granted exact tools, and the audit checks that each research agent holds the grants it needs.

> **Breaking change (2026-09):** this replaces the old `.claude/` + `.github/` drop-in trees. See [Migrating from the drop-in trees](#migrating-from-the-drop-in-trees). The design record is [docs/2026-09-plugin-architecture.md](docs/2026-09-plugin-architecture.md).

---

## Plugins

| Plugin | Ships | Depends on |
| --- | --- | --- |
| `andes-core` | **Skills:** `andes-init`, `prd`, `technical-writing`<br>**Agents:** `andes-prd-generator`, `andes-se-technical-writer`<br>**Copilot-only agents:** `andes-planner-expert`, `andes-full-stack-expert`<br>**MCP:** `context7` | — |
| `andes-dotnet` | **Skills:** `csharp-standards`, `dotnet-api-architecture`, `aspnet-rest-apis`, `azure-functions-csharp`, `csharp-mcp-server`, `csharp-async`, `csharp-docs`, `csharp-xunit`, `ef-core`, `ef-core-base-entities`, `ef-core-enum-reference-tables`, `microsoft-agent-framework`, `microsoft-docs`<br>**Agents:** `andes-csharp-code-reviewer`<br>**Copilot-only agents:** `andes-csharp-expert`, `andes-csharp-dotnet-janitor`<br>**MCP:** `microsoft-learn` | `andes-core` |
| `andes-dotnet-wasm` | **Skills:** `blazor-wasm` (standalone Blazor WebAssembly, .NET 10) | `andes-core`, `andes-dotnet` |
| `andes-angular` | **Skills:** `angular-standards`, `angular-ui-architecture`, `ngrx-signal-store`, `angular-developer` (official Angular team skill, vendored)<br>**Agents:** `andes-angular-code-reviewer`<br>**Copilot-only agents:** `andes-angular-expert`<br>**MCP:** `angular-cli` | `andes-core` |
| `andes-github` | **Skills:** `github-actions-hardening`, `github-actions-efficiency`, `github-actions-runtime-upgrade-conventions`<br>**Agents:** `andes-github-actions-reviewer` | `andes-core` |
| `andes-terraform` | **Skills:** `terraform-conventions`<br>**MCP:** `terraform` | `andes-core` |
| `andes-azure-devops` | **Skills:** `azure-devops-init`<br>**Agents:** `andes-ado-backlog-manager`<br>**MCP:** `azure-devops` | `andes-core` |

Claude Code installs dependencies automatically. On Copilot, install them yourself (see [Install](#install)).

When you run `andes-init`, it reports which plugins match your repository (for example, `*.csproj` suggests `andes-dotnet` and `angular.json` suggests `andes-angular`) and which of those are not installed yet.

---

## Install

### Claude Code

```text
/plugin marketplace add RorroRojas3/awesome-claude-copilot
/plugin install andes-dotnet@andes
/andes-core:andes-init
```

Install each stack plugin you need. Its dependencies install with it, so `andes-dotnet` brings in `andes-core`. Then run `andes-init` once per repository. It asks before it changes anything except the `andes` block and the `CLAUDE.md` import:

1. **`AGENTS.md`.** Writes or refreshes the managed block between `<!-- andes:begin … -->` and `<!-- andes:end -->`. Text outside the markers is never touched. When it creates the file, it also appends placeholder sections (About this repository, Layout, Build/test/run, Conventions) for the team to fill in.
2. **`CLAUDE.md`.** Adds an `@AGENTS.md` import, or creates `CLAUDE.md` with just that line. The import matters: a `CLAUDE.local.md` silently turns off Claude Code's native `AGENTS.md` loading, and the import still works when one exists.
3. **Opt-in settings**, offered one at a time, each shown as a diff first:
   - the `andes` marketplace and `enabledPlugins` for a team rollout
   - a `permissions.deny` for the Angular CLI `ai_tutor` tool
   - `"effortLevel": "xhigh"`
4. **Cleanup.** Offers to delete old drop-in copies.

Re-run `andes-init` after you update the plugins. A run with nothing new changes nothing. Plugin agents appear as `andes-<plugin>:andes-<role>`, for example `andes-dotnet:andes-csharp-code-reviewer`. Verified with Claude Code 2.1.283.

**Azure DevOps.** After installing `andes-azure-devops`, set `ADO_ORG` to your organization name in the environment that starts Claude Code, run `az login`, restart, then run `/andes-azure-devops:azure-devops-init` once per repository. It records the project, team, area path, process, iteration root, and assignable people in `AGENTS.md`; `andes-ado-backlog-manager` refuses to write until that section exists.

### GitHub Copilot CLI

These commands follow GitHub's Copilot CLI plugin docs. They have **not yet been verified end to end** with these plugins; see the [Copilot checklist](docs/2026-09-plugin-architecture.md#not-yet-verified-github-copilot-checklist).

```shell
copilot plugin marketplace add RorroRojas3/awesome-claude-copilot
copilot plugin install andes-core@andes
copilot plugin install andes-dotnet@andes
```

On Copilot, the plugins use the Agent Plugins 1.0 format, which has no `dependencies` field. That means you install dependencies yourself: always install `andes-core`, and install `andes-dotnet` before `andes-dotnet-wasm`. Then run the `andes-init` skill (`/andes-init`). The files it writes serve both harnesses, so you can also run it once from Claude Code. Whether Copilot CLI expands `${ADO_ORG}` in a plugin's `mcp.json` is not yet verified; `azure-devops-init` explains the manual registration fallback.

The Copilot agents declare no `target`, which GitHub defines as both environments: `github-copilot` (Copilot CLI, the Copilot coding agent, github.com) and `vscode`.

### VS Code (local Copilot): unverified

The agents load in VS Code because they declare no `target`. They keep one frontmatter shape for every surface: plain tool aliases, exact `server/tool` MCP grants, and no VS Code tools (`vscode/askQuestions`, `vscode/memory`). The one exception is `andes-planner-expert`. It declares handoff buttons, which in a VS Code Local session pass the approved plan to its implementer. Copilot CLI and the cloud agent ignore the buttons. Nothing else has been verified in VS Code: installing the plugins, loading their skills, and starting their MCP servers are untested there. `andes-init` does not write VS Code settings, and the maintainer commands are skills rather than VS Code prompt files.

---

## Agents

In Claude Code, the main session writes the code and delegates review, docs, and PRDs to agents. Copilot also has implementer agents.

| Agent | Plugin | Claude Code | Copilot | Role |
| --- | --- | --- | --- | --- |
| `andes-csharp-code-reviewer` | `andes-dotnet` | yes | yes | Report-only C#/.NET review, including Blazor |
| `andes-angular-code-reviewer` | `andes-angular` | yes | yes | Report-only Angular and NgRx review |
| `andes-github-actions-reviewer` | `andes-github` | yes | yes | Report-only workflow review: security, efficiency, runtime currency |
| `andes-prd-generator` | `andes-core` | yes | yes | Writes PRDs under `docs/prd/` with the `PRD-STATUS` report contract on both harnesses; creates GitHub issues only after you approve |
| `andes-se-technical-writer` | `andes-core` | yes | yes | Writes `docs/` and owns `CHANGELOG.md` |
| `andes-ado-backlog-manager` | `andes-azure-devops` | yes | yes | Creates, updates, and removes (State = Removed) Epics, Features, and User Stories in Azure DevOps, also from a PRD; previews first with the `ADO-STATUS` contract and always asks for assignee and iteration |
| `andes-planner-expert` | `andes-core` | — | yes | Researches and plans; invokes `andes-prd-generator` first when a feature needs requirements; writes the plan to `docs/plans/` and names the implementer to run next (handoff buttons in VS Code) |
| `andes-full-stack-expert` | `andes-core` | — | yes | Writes the API contract, delegates the back end and front end in parallel, documents once. Needs `andes-dotnet` and `andes-angular` |
| `andes-csharp-expert` | `andes-dotnet` | — | yes | Implements C#/.NET code: APIs, Functions, MCP servers, Blazor, EF Core |
| `andes-csharp-dotnet-janitor` | `andes-dotnet` | — | yes | Cleanup and modernization in small, tested batches |
| `andes-angular-expert` | `andes-angular` | — | yes | Implements Angular code: components, signals, forms, routing, Signal Store |

The typical Copilot flow is `andes-planner-expert` (which invokes `andes-prd-generator` when a feature has no PRD and its requirements are unclear) → implementer → reviewer → `andes-se-technical-writer`. You can also run `andes-prd-generator` directly. The PRD generator never invokes the planner. Plans live under `docs/plans/` and, like PRDs, get no changelog entry.

Every research and implementer agent is granted exact MCP tools for its stack — `microsoft-learn` for .NET, `angular-cli` for Angular, `context7` (from `andes-core`) for any other library — and the repo audit fails if a required grant is missing.

Models and reasoning effort:

- **Claude.** Reviewers and the PRD and writer agents run on Sonnet. `andes-github-actions-reviewer` runs on Opus. Reviewers use `effort: xhigh`; `andes-prd-generator`, `andes-se-technical-writer`, and `andes-ado-backlog-manager` use `high`.
- **Copilot.** Agents run on Claude Sonnet 5.5. `andes-planner-expert` and `andes-full-stack-expert` run on Claude Opus 5.5. `andes-se-technical-writer` runs on Claude Haiku 4.5 to save cost.
- **Copilot reasoning effort.** Each agent pins `reasoning-effort`, tiered by role because a higher level consumes more AI Credits. The three reviewers, `andes-prd-generator`, and `andes-planner-expert` use `high`. The implementers, `andes-full-stack-expert`, `andes-csharp-dotnet-janitor`, and `andes-ado-backlog-manager` use `medium`. `andes-se-technical-writer` has no key, because Claude Haiku 4.5 has no configurable reasoning. The key needs Copilot CLI 1.0.88 or later and must be spelled `reasoning-effort`; the `reasoningEffort` spelling in the CLI reference is not applied ([github/copilot-cli#4963](https://github.com/github/copilot-cli/issues/4963)). An explicit `--reasoning-effort` flag overrides it. Whether the Copilot coding agent reads the key is unverified.

---

## Review loop

After a code change, the implementer runs the matching reviewer on the diff:

| Change | Reviewer |
| --- | --- |
| C#, including Blazor | `andes-csharp-code-reviewer` |
| Angular | `andes-angular-code-reviewer` |
| Workflows and composite actions | `andes-github-actions-reviewer` |
| Terraform | No reviewer. Run `terraform fmt -check` and `terraform validate` |

The loop works like this:

1. **Report.** Reviewers report only **High** and **Medium** findings, plus a verdict. They never edit files and never hand work back.
2. **Fix and re-review.** The implementer fixes every finding, then reruns the reviewer once, on only the files changed since round 1.
3. **Stop after two rounds.** If High findings remain after round 2, the implementer stops and reports them to you. Open Medium findings go in the final summary.
4. **Document.** After a passing verdict (**Approve** or **Approve with changes**), `andes-se-technical-writer` updates `docs/` and adds the `CHANGELOG.md` entry.

`andes-full-stack-expert` counts rounds per side, so neither the back end nor the front end gets more than two. The loop text lives in `AGENTS.md`. It is also copied word for word into the Copilot implementers, because Copilot subagents do not receive `AGENTS.md`.

---

## Testing policy (.NET)

- **Libraries.** Use xUnit v3 (latest, on Microsoft Testing Platform: `dotnet new xunit3`) with xUnit's `Assert`, and NSubstitute for test doubles. Never use FluentAssertions, AwesomeAssertions, Shouldly, Moq, FakeItEasy, NUnit, or MSTest.
- **Layout.** Two test projects per solution under `tests/`, `<Root>.Unit.Test` and `<Root>.Integration.Test`, with folders mirroring the source projects and `TestInfrastructure/` at each root (`dotnet-api-architecture`).
- **Test databases.** Try these in order:
  1. Testcontainers
  2. SQLite in-memory
  3. A dedicated physical test database
  4. EF Core InMemory, only as a last resort
- **Existing suites.** New tests follow the policy, and no banned package gets added. Existing tests are migrated only when you ask.

The policy lives in `csharp-xunit`, `csharp-standards`, and `ef-core`. `andes-csharp-code-reviewer` enforces it, and the repo audit fails if any plugin text recommends a banned library.

---

## C# non-negotiables

These apply to every new or changed C# file. Existing code is migrated only when you ask.

- **Minimal APIs only.** No MVC controllers, no `[ApiController]`, no `AddControllers()`. Endpoint groups per resource, `TypedResults`, endpoint filters (`aspnet-rest-apis`).
- **FluentValidation only.** One `AbstractValidator<T>` per request type, run from a shared endpoint filter. No DataAnnotations, no `AddValidation()`, not in Blazor forms either.
- **File layout.** Fields and properties, then interface implementations, then `#region Private methods`, `#region Public static methods`, and `#region Logging` (the `[LoggerMessage]` methods), in that order and always last (`csharp-standards`).
- **Primary constructors**, **collection expressions**, and **`var`** wherever the initializer has a type; logging only through `[LoggerMessage]` source-generated methods.

`andes-csharp-code-reviewer` reports new controllers or DataAnnotations as High and layout, `var`, or logging violations as Medium. The repo audit (`csharp-policy`) fails if any plugin text recommends controllers or DataAnnotations.

---

## MCP servers and tool scoping

| Server | Plugin | Launch | Why it is configured this way |
| --- | --- | --- | --- |
| `microsoft-learn` | `andes-dotnet` | HTTP `https://learn.microsoft.com/api/mcp` | Grounds .NET and Azure answers in official docs |
| `context7` | `andes-core` | HTTP `https://mcp.context7.com/mcp` | Remote and anonymous (no API key; anonymous rate limit). Ships with `andes-core` so every research agent can ground any other library's docs |
| `angular-cli` | `andes-angular` | `npx -y @angular/cli@latest mcp --read-only` | Floats on `@latest` on purpose, so the MCP tool set (including `find_examples`) tracks the current CLI. `--read-only` drops the `run_target` and devserver tools |
| `terraform` | `andes-terraform` | `docker run -i --rm hashicorp/terraform-mcp-server:1.3.0 --toolsets=registry` | Pinned image, public-registry toolset only. Requires Docker |
| `azure-devops` | `andes-azure-devops` | `npx -y @azure-devops/mcp@2.10.0 ${ADO_ORG} -d core work work-items --authentication azcli` | Pinned. Only the `core`, `work`, and `work-items` domains (no test plans, repositories, pipelines, wiki, or search). Organization from `ADO_ORG`; authentication is your `az login` session. Requires Node.js 20+ and the Azure CLI |

Each plugin declares its servers twice, with the same entries:

- `.mcp.json` for Claude Code.
- `mcp.json` for Copilot, in Agent Plugins format. There, the remote servers (`microsoft-learn`, `context7`) use `type: streamable-http`.

The repo audit fails if the two drift (URL, command, args, headers, or env), and if a Claude tool name credits the wrong plugin for a server (`mcp__plugin_andes-core_context7__query-docs`, never `andes-dotnet`).

Tool scoping:

- **Exact grants.** Every agent lists exact MCP tools, never a whole server.
  - Claude tool names look like `mcp__plugin_andes-angular_angular-cli__get_best_practices`.
  - Copilot tool names look like `angular-cli/get_best_practices`.
- **Unknown names are ignored.** So `find_examples` (which exists only on Angular CLI 21) can be granted safely. The same goes for the `microsoft-learn` tools granted to the `andes-core` agents when `andes-dotnet` is not installed.
- **`ai_tutor`.** The Angular CLI server has no flag to remove its `ai_tutor` tool. No agent is granted it, and `andes-init` offers a `permissions.deny` for Claude's main session.
- **Node version.** Angular CLI 22.2 requires Node ≥ 22.22.3.
- **No delete.** The Azure DevOps server has no delete tool. `andes-ado-backlog-manager` sets `System.State` to `Removed`, which hides the item from every backlog and board; the Basic process has no such state.

---

## Context and cost

| Measure | Old drop-in trees | Plugins |
| --- | --- | --- |
| Always-on standards | `CLAUDE.md` 1,263 words; `copilot-instructions.md` 995 words | `AGENTS.md` block, about 640 words |
| Loaded automatically on a `.cs` edit (Claude Code) | 4 rules, about 2,566 words | Nothing. Only the skills the change needs |

Skill descriptions are the always-on price of each installed plugin. Measured on 2026-09-29 from the working tree with `claude --plugin-dir plugins/<name> plugin details <name>` (Claude Code 2.1.207):

| Plugin | Tokens |
| --- | --- |
| `andes-core` | ~316 |
| `andes-dotnet` | ~1,517 |
| `andes-dotnet-wasm` | ~126 |
| `andes-angular` | ~507 |
| `andes-github` | ~278 |
| `andes-terraform` | ~98 |
| `andes-azure-devops` | ~138 |
| All seven | ~2,980 |

The figures cover skills only. The command lists no agents for a plugin loaded from disk, so agent descriptions are not counted, and MCP tool schemas are resolved at runtime.

The repo audit warns when a skill body passes 20,000 characters, an agent body passes 12,000, or an agent description passes 550.

On Copilot, output tokens cost five times as much as input tokens, and Anthropic bills reasoning as output tokens. That makes `reasoning-effort` a larger cost lever than context size; see [Agents](#agents) for the value each agent pins.

Claude Code limits the skill listing to about 1% of context, and when that overflows it drops the descriptions of rarely used skills. The routing table in `AGENTS.md` names skills by file type, so the right skill still loads without its description.

`effortLevel: xhigh` for the main session costs more per turn. That is why `andes-init` asks about it separately.

---

## Migrating from the drop-in trees

The pre-plugin layout is commit [`97943de`](https://github.com/RorroRojas3/awesome-claude-copilot/tree/97943de) on `main`.

1. **Install the plugins.** Follow the [Install](#install) steps for your harness.
2. **Run `andes-init`.** It lists leftovers from the old layout and offers to delete them as one batch:
   - `.claude/rules/*.md` and `.github/instructions/*.instructions.md`
   - `.claude/agents/*` and `.github/agents/*`
   - `.claude/skills/<name>` and `.github/skills/<name>` for any skill a plugin now ships
   - the MCP servers in `.mcp.json` and `.vscode/mcp.json`
   - `microsoft-docs@claude-plugins-official`, which starts a second Microsoft Learn server
3. **Move project-specific text** from `.github/copilot-instructions.md` into `AGENTS.md`, outside the markers. Copilot loads both files, so `andes-init` offers to delete it afterward.

Why cleanup matters: in Copilot CLI, project-level agents and skills win over plugin ones (first found wins). An old `.claude/skills/csharp-async` would silently shadow the plugin's `csharp-async`.

What was renamed:

| Old | New |
| --- | --- |
| `csharp-code-reviewer`, `angular-code-reviewer`, `github-actions-reviewer`, `prd-generator`, `se-technical-writer` | The same roles with an `andes-` prefix |
| `planner-expert`, `csharp-expert`, `angular-expert`, `full-stack-expert`, `csharp-dotnet-janitor` | The same roles with an `andes-` prefix (Copilot only) |
| `csharp-mcp-expert` | Merged into `andes-csharp-expert` |
| Rule `csharp` | Skill `csharp-standards` |
| Rule `terraform` | Skill `terraform-conventions` |
| Rules `aspnet-rest-apis`, `azure-functions-csharp`, `csharp-mcp-server`, `blazor-wasm` | Skills with the same names |
| Rules `api-architecture`, `ui-architecture` (kept in some repositories) | Skills `dotnet-api-architecture`, `angular-ui-architecture` |

---

## Maintaining this repository

```text
.
├── .claude-plugin/marketplace.json     # the andes marketplace
├── plugins/andes-<name>/
│   ├── .claude-plugin/plugin.json      # Claude Code manifest; lists every claude-agents/ file
│   ├── plugin.json                     # Copilot manifest (Agent Plugins 1.0): $schema + metadata only
│   ├── skills/                         # shared by both harnesses
│   ├── claude-agents/                  # Claude Code agents (*.md)
│   ├── com.github.copilot/agents/      # Copilot agents (*.agent.md)
│   ├── .mcp.json                       # Claude Code MCP servers (optional)
│   └── mcp.json                        # Copilot MCP servers, Agent Plugins format (optional; same servers)
├── AGENTS.md                           # the andes block (= andes-init template) + this repo's own sections
├── CLAUDE.md                           # exactly "@AGENTS.md"
├── .claude/skills/                     # maintainer-only /repo-audit, /ngrx-signals-sync, /release (not shipped)
├── .claude/settings.json               # maintainer settings (enables andes-core, andes-github)
├── .github/workflows/repo-audit.yml    # CI
├── scripts/repo-audit.mjs              # structural audit
├── scripts/release.mjs                 # release: CHANGELOG roll, tag, GitHub Release
├── scripts/upstream-skills.lock.json   # hash pin for angular-developer
└── docs/                               # ADRs and change records
```

**Why this layout.**

- **Copilot uses Agent Plugins 1.0.** Copilot switches to Agent Plugins 1.0 when a root `plugin.json` declares `"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`. Skills (`skills/`), MCP (`mcp.json`), and Copilot agents (`com.github.copilot/agents/`) sit at fixed locations, so that manifest has no path fields.
- **Maintainer commands are skills.** `.claude/skills/` is read by Claude Code and by Copilot CLI (which also scans `.github/skills` and `.agents/skills`), so each command exists once. VS Code prompt files (`.github/prompts/`) never load in the CLI and are gone. No skill sets `disable-model-invocation: true`: Copilot CLI cannot invoke such a skill at all ([copilot-cli#4438](https://github.com/github/copilot-cli/issues/4438)), so skills guard in their body instead.
- **Claude Code uses its own files.** It reads `.claude-plugin/plugin.json`, `.mcp.json`, and the listed `claude-agents/` files.
- **Neither loads the other's agents.** Neither agent folder is a default `agents/` folder. The audit rejects `agents/`, `commands/`, `hooks/`, and `.github/` folders inside a plugin.

**Develop against live files.** Load a plugin from its folder instead of the marketplace cache:

```shell
claude --plugin-dir plugins/andes-core --plugin-dir plugins/andes-<name>
```

**Bump versions on every change.** Installs are cached by version, so bump `version` in *both* manifests of every plugin you change. CI enforces this on PRs with `--base`.

**Keep copies in sync.**

- **Agent twins.** A Claude agent and its Copilot twin change together, and their descriptions match apart from the word PROACTIVELY.
- **Copilot agents.** No `target`, so they load in VS Code and `github-copilot`; `model` as a pair from the audit's `modelParity` table, CLI slug first and VS Code display name second (`[claude-sonnet-5.5, Claude Sonnet 5.5 (copilot)]`); `reasoning-effort` equal to the audit's `copilotEffort` table; plain tool aliases (`read`, `edit`, `search`, `execute`, `agent`, `web`, `todo`) and exact `server/tool` MCP grants; no `argument-hint` or `vscode/*` tools; no `handoffs` except on `andes-planner-expert`, whose targets must be marketplace agents or the built-in `agent`; an `agents:` list only together with the `agent` tool, and never pointing at an agent that has `disable-model-invocation: true`.
- **MCP files.** `.mcp.json` and `mcp.json` list the same servers.
- **The `AGENTS.md` block.** Edit `plugins/andes-core/skills/andes-init/assets/agents-block.md`, then copy it word for word between the markers in `AGENTS.md`.
- **The review loop.** Copy its `## Review loop` section word for word into the Copilot implementers.

**Never edit `angular-developer`.** `plugins/andes-angular/skills/angular-developer/` is vendored from upstream and hash-pinned in `scripts/upstream-skills.lock.json`. The audit fails on any local edit.

**Conventions.**

- **Skills.** The folder name equals the `name` field. Descriptions are trigger-style ("Use when …") and at most 400 characters. No `paths:` or `applyTo:` frontmatter. Refer to other skills and agents by name, never by a `.claude/` or `.github/` path, because those paths don't exist once a plugin is installed.
- **Agents.** Each is named `andes-<role>`, equal to its file stem, and pins a model. Claude `effort` is `xhigh` for reviewers and `high` for everything else.
  - **Model parity.** Copilot models follow the parity table in `scripts/repo-audit.mjs`. Per-harness overrides must be recorded there and in `docs/`.
  - **Reviewers.** They keep High/Medium only and get no edit or agent tools.

**Audit.** Run the audit before committing:

```shell
node scripts/repo-audit.mjs                     # human-readable report
node scripts/repo-audit.mjs --strict            # warnings also fail
node scripts/repo-audit.mjs --base=origin/main  # also require version bumps for changed plugins
claude plugin validate .                        # marketplace manifest
```

- **Checks:** `manifests`, `skills`, `harness-paths`, `agents`, `mcp`, `memory`, `testing-policy`, `csharp-policy`, `registry`, `changelog`.
- **Exit codes:** `0` clean, `10` findings, `1` the script failed.
- **`/repo-audit`** runs the same checks inside Claude Code or Copilot CLI (it is a skill in `.claude/skills/`). It is report-only unless you pass `--fix`, which applies only mechanical repairs and never commits.

**Release.** Plugins are versioned per change; a release is the marketplace event. From a clean, up-to-date `main`:

```text
/release minor            # dry run first, then asks for a yes
node scripts/release.mjs minor --dry-run   # the script underneath
```

`scripts/release.mjs` checks the branch, tree, `gh` login, audit, and `claude plugin validate`, then moves `## [Unreleased]` in `CHANGELOG.md` under `## [X.Y.Z] - <date>` (keeping the compare links), commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, pushes with the tag, and creates the GitHub Release with that section plus a table of the plugin versions it ships. Exit codes: `0` released or dry run, `2` a precondition failed, `1` the script failed. It never touches plugin versions.

**CI.** `.github/workflows/repo-audit.yml` runs on PRs that touch plugin or config paths, and on pushes to `main`.

- Audit errors fail the job. Warnings stay advisory.
- `claude plugin validate --strict` runs on the marketplace and on every plugin.
- Actions are SHA-pinned and kept current by Dependabot.

**NgRx sync.** `ngrx-signal-store` is pinned to upstream NgRx doc snapshots in its `sources.json`. Check and refresh it with:

```text
/ngrx-signals-sync              # check, and update the skill if upstream moved
/ngrx-signals-sync --check-only # report drift only
```

The underlying check is `node plugins/andes-angular/skills/ngrx-signal-store/scripts/check-updates.mjs`, with exit codes `0` current, `10` drifted, `1` failed. Set `GITHUB_TOKEN` to raise the API rate limit. Never hand-edit the shas in `sources.json`; use `--pin`. A sync leaves edits in the working tree for review and bumps `andes-angular`.

**Requirements:**

- **Node.** 18 or later runs the audit and sync scripts, which use only built-ins. CI uses Node 22.
- **Docker** for the `terraform` MCP server.
- **The [`gh` CLI](https://cli.github.com)** for turning PRD stories into GitHub issues.
- **Azure CLI** (`az login`), **Node.js 20+**, and an `ADO_ORG` environment variable for the `azure-devops` MCP server.

---

## Docs

- [docs/2026-09-plugin-architecture.md](docs/2026-09-plugin-architecture.md) is the ADR for this layout. It covers verification results, the Copilot checklist, and fallbacks.
- [docs/2026-09-copilot-harness-and-release.md](docs/2026-09-copilot-harness-and-release.md) records the move to the `github-copilot` harness, the planner → PRD direction, Context7 in `andes-core`, the C# non-negotiables, maintainer skills, and the release process.
- [docs/2026-09-architecture-skills.md](docs/2026-09-architecture-skills.md) records the `dotnet-api-architecture` and `angular-ui-architecture` skills: the split between `SKILL.md` and `references/`, the routing rows, and the decisions on EF mapping, test layout, and styling.
- [docs/2026-09-persistence-layout-and-ef-core-entity-skills.md](docs/2026-09-persistence-layout-and-ef-core-entity-skills.md) records one type per file with `Models/` subfolders, repositories in Service over a plumbing-only Repository, and the `ef-core-base-entities` and `ef-core-enum-reference-tables` skills.
- [docs/2026-09-azure-devops-plugin.md](docs/2026-09-azure-devops-plugin.md) records the `andes-azure-devops` plugin: the local stdio server and its three domains, `azcli` authentication, the `ADO-STATUS` contract, why removal is `State = Removed`, and the open Copilot `${ADO_ORG}` question.
- [docs/2026-09-copilot-reasoning-effort.md](docs/2026-09-copilot-reasoning-effort.md) records the per-agent `reasoning-effort` values on Copilot, the removal of `target`, the context trims, and what is still unverified.
- [docs/2026-09-planner-handoffs.md](docs/2026-09-planner-handoffs.md) records why the planner declares handoff buttons for VS Code Local sessions, the audit exemption, and when the buttons will be removed.
- The `docs/2026-08-*.md` files record earlier decisions. Parts of them are superseded by the ADR.
- [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
