# awesome-claude-copilot

[![Claude Code](https://img.shields.io/badge/Claude_Code-config-d97757?logo=claude&logoColor=white)](https://code.claude.com)
[![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-config-8957e5?logo=githubcopilot&logoColor=white)](https://github.com/features/copilot)
[![.NET](https://img.shields.io/badge/.NET-C%23_14-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![Angular](https://img.shields.io/badge/Angular-NgRx_Signals-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/RorroRojas3/awesome-claude-copilot/pulls)

This repository is the **`andes` plugin marketplace**. It packages engineering standards for C#/.NET, Angular, GitHub Actions, and Terraform as plugins for [Claude Code](https://code.claude.com) and [GitHub Copilot](https://github.com/features/copilot). Each plugin lives in one directory that serves both harnesses. You install only the stacks you use, and updates arrive through the marketplace instead of by re-copying files.

It contains no application code, only assistant configuration: skills, agents, MCP servers, and a shared `AGENTS.md` block.

How it fits together:

- **A short always-on block.** A 505-word `AGENTS.md` block, installed by `andes-init`, is the only text loaded every session. Both harnesses read it.
- **Standards load on demand.** The detailed standards are skills. A file-type → skill routing table in `AGENTS.md` tells the model which ones to load.
- **Reviewers only report.** They report High and Medium findings with a verdict. The review loop is capped at two rounds, and then the technical writer documents the change.
- **MCP servers ship with their plugin.** Each server is pinned or scoped, and every agent is granted exact tools.

> **Breaking change (2026-09):** this replaces the old `.claude/` + `.github/` drop-in trees. See [Migrating from the drop-in trees](#migrating-from-the-drop-in-trees). The design record is [docs/2026-09-plugin-architecture.md](docs/2026-09-plugin-architecture.md).

---

## Plugins

| Plugin | Ships | Depends on |
| --- | --- | --- |
| `andes-core` | **Skills:** `andes-init`, `prd`, `technical-writing`<br>**Agents:** `andes-prd-generator`, `andes-se-technical-writer`<br>**Copilot-only agents:** `andes-planner-expert`, `andes-full-stack-expert` | — |
| `andes-dotnet` | **Skills:** `csharp-standards`, `aspnet-rest-apis`, `azure-functions-csharp`, `csharp-mcp-server`, `csharp-async`, `csharp-docs`, `csharp-xunit`, `ef-core`, `microsoft-agent-framework`, `microsoft-docs`<br>**Agents:** `andes-csharp-code-reviewer`<br>**Copilot-only agents:** `andes-csharp-expert`, `andes-csharp-dotnet-janitor`<br>**MCP:** `microsoft-learn`, `context7` | `andes-core` |
| `andes-dotnet-wasm` | **Skills:** `blazor-wasm` (standalone Blazor WebAssembly, .NET 10) | `andes-core`, `andes-dotnet` |
| `andes-angular` | **Skills:** `angular-standards`, `ngrx-signal-store`, `angular-developer` (official Angular team skill, vendored)<br>**Agents:** `andes-angular-code-reviewer`<br>**Copilot-only agents:** `andes-angular-expert`<br>**MCP:** `angular-cli` | `andes-core` |
| `andes-github` | **Skills:** `github-actions-hardening`, `github-actions-efficiency`, `github-actions-runtime-upgrade-conventions`<br>**Agents:** `andes-github-actions-reviewer` | `andes-core` |
| `andes-terraform` | **Skills:** `terraform-conventions`<br>**MCP:** `terraform` | `andes-core` |

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

1. **`AGENTS.md`.** Writes or refreshes the managed block between `<!-- andes:begin … -->` and `<!-- andes:end -->`. Text outside the markers is never touched.
2. **`CLAUDE.md`.** Adds an `@AGENTS.md` import, or creates `CLAUDE.md` with just that line. The import matters: a `CLAUDE.local.md` silently turns off Claude Code's native `AGENTS.md` loading, and the import still works when one exists.
3. **Opt-in settings**, offered one at a time, each shown as a diff first:
   - the `andes` marketplace and `enabledPlugins` for a team rollout
   - a `permissions.deny` for the Angular CLI `ai_tutor` tool
   - `"effortLevel": "xhigh"`
   - the VS Code settings listed below
4. **Cleanup.** Offers to delete old drop-in copies.

Re-run `andes-init` after you update the plugins. A run with nothing new changes nothing. Plugin agents appear as `andes-<plugin>:andes-<role>`, for example `andes-dotnet:andes-csharp-code-reviewer`. Verified with Claude Code 2.1.283.

### GitHub Copilot CLI

These commands follow GitHub's Copilot CLI plugin docs. They have **not yet been verified end to end** with these plugins; see the [Copilot checklist](docs/2026-09-plugin-architecture.md#not-yet-verified-github-copilot-checklist).

```shell
copilot plugin marketplace add RorroRojas3/awesome-claude-copilot
copilot plugin install andes-core@andes
copilot plugin install andes-dotnet@andes
```

On Copilot, the plugins use the Agent Plugins 1.0 format, which has no `dependencies` field. That means you install dependencies yourself: always install `andes-core`, and install `andes-dotnet` before `andes-dotnet-wasm`. Then run the `andes-init` skill. The files it writes serve both harnesses, so you can also run it once from Claude Code.

### VS Code (GitHub Copilot)

Add this to your user or workspace `settings.json`:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["RorroRojas3/awesome-claude-copilot"],
  "chat.useAgentsMdFile": true
}
```

Then search `@agentPlugins` in the Extensions view and install the plugins, including `andes-core` (dependencies are not installed automatically, as with Copilot CLI). VS Code also reads `extraKnownMarketplaces` and `enabledPlugins` from `.claude/settings.json` as workspace recommendations, so the team-rollout setting that `andes-init` offers covers VS Code too. Like the Copilot CLI steps, this is not yet verified end to end.

---

## Agents

In Claude Code, the main session writes the code and delegates review, docs, and PRDs to agents. Copilot also has implementer agents.

| Agent | Plugin | Claude Code | Copilot | Role |
| --- | --- | --- | --- | --- |
| `andes-csharp-code-reviewer` | `andes-dotnet` | yes | yes | Report-only C#/.NET review, including Blazor |
| `andes-angular-code-reviewer` | `andes-angular` | yes | yes | Report-only Angular and NgRx review |
| `andes-github-actions-reviewer` | `andes-github` | yes | yes | Report-only workflow review: security, efficiency, runtime currency |
| `andes-prd-generator` | `andes-core` | yes | yes | Writes PRDs under `docs/prd/`; creates GitHub issues only after you approve |
| `andes-se-technical-writer` | `andes-core` | yes | yes | Writes `docs/` and owns `CHANGELOG.md` |
| `andes-planner-expert` | `andes-core` | — | yes | Researches and plans, then hands off to an implementer |
| `andes-full-stack-expert` | `andes-core` | — | yes | Writes the API contract, delegates the back end and front end in parallel, documents once. Needs `andes-dotnet` and `andes-angular` |
| `andes-csharp-expert` | `andes-dotnet` | — | yes | Implements C#/.NET code: APIs, Functions, MCP servers, Blazor, EF Core |
| `andes-csharp-dotnet-janitor` | `andes-dotnet` | — | yes | Cleanup and modernization in small, tested batches |
| `andes-angular-expert` | `andes-angular` | — | yes | Implements Angular code: components, signals, forms, routing, Signal Store |

The typical Copilot flow is `andes-prd-generator` (optional) → `andes-planner-expert` → implementer → reviewer → `andes-se-technical-writer`.

Models and reasoning effort:

- **Claude.** Reviewers and the PRD and writer agents run on Sonnet. `andes-github-actions-reviewer` runs on Opus. Reviewers use `effort: xhigh`, and `andes-prd-generator` and `andes-se-technical-writer` use `high`.
- **Copilot.** Agents run on Claude Sonnet 5. `andes-se-technical-writer` is the exception: it runs on Claude Haiku 4.5 to save cost.

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

- **Libraries.** Use xUnit v3 with xUnit's `Assert`, and NSubstitute for test doubles. Never use FluentAssertions, AwesomeAssertions, Shouldly, Moq, FakeItEasy, NUnit, or MSTest.
- **Test databases.** Try these in order:
  1. Testcontainers
  2. SQLite in-memory
  3. A dedicated physical test database
  4. EF Core InMemory, only as a last resort
- **Existing suites.** New tests follow the policy, and no banned package gets added. Existing tests are migrated only when you ask.

The policy lives in `csharp-xunit`, `csharp-standards`, and `ef-core`. `andes-csharp-code-reviewer` enforces it, and the repo audit fails if any plugin text recommends a banned library.

---

## MCP servers and tool scoping

| Server | Plugin | Launch | Why it is configured this way |
| --- | --- | --- | --- |
| `microsoft-learn` | `andes-dotnet` | HTTP `https://learn.microsoft.com/api/mcp` | Grounds .NET and Azure answers in official docs |
| `context7` | `andes-dotnet` | `npx -y @upstash/context7-mcp@4.1.1` | Pinned. Covers docs outside Microsoft Learn |
| `angular-cli` | `andes-angular` | `npx -y @angular/cli mcp --read-only` | Unpinned on purpose, so `npx` uses your project-local CLI and the tools match your Angular version. `--read-only` drops the `run_target` and devserver tools |
| `terraform` | `andes-terraform` | `docker run -i --rm hashicorp/terraform-mcp-server:1.3.0 --toolsets=registry` | Pinned image, public-registry toolset only. Requires Docker |

Each plugin declares its servers twice, with the same entries:

- `.mcp.json` for Claude Code.
- `mcp.json` for Copilot, in Agent Plugins format. There, `microsoft-learn` uses `type: streamable-http`.

The repo audit fails if the two drift.

Tool scoping:

- **Exact grants.** Every agent lists exact MCP tools, never a whole server.
  - Claude tool names look like `mcp__plugin_andes-angular_angular-cli__get_best_practices`.
  - Copilot tool names look like `angular-cli/get_best_practices`.
- **Unknown names are ignored.** So `find_examples` (which exists only on Angular CLI 21) can be granted safely. The same goes for the `microsoft-learn` tools granted to the `andes-core` agents when `andes-dotnet` is not installed.
- **`ai_tutor`.** The Angular CLI server has no flag to remove its `ai_tutor` tool. No agent is granted it, and `andes-init` offers a `permissions.deny` for Claude's main session.
- **Node version.** Angular CLI 22.2 requires Node ≥ 22.22.3.

---

## Context and cost

| Measure | Old drop-in trees | Plugins |
| --- | --- | --- |
| Always-on standards | `CLAUDE.md` 1,263 words; `copilot-instructions.md` 995 words | `AGENTS.md` block, 505 words |
| Loaded automatically on a `.cs` edit (Claude Code) | 4 rules, about 2,566 words | Nothing. Only the skills the change needs |

Skill descriptions are the always-on price of each installed plugin. Measured with `claude plugin details`:

| Plugin | Tokens |
| --- | --- |
| `andes-core` | ~301 |
| `andes-dotnet` | ~963 |
| `andes-dotnet-wasm` | ~126 |
| `andes-angular` | ~364 |
| `andes-github` | ~278 |
| `andes-terraform` | ~98 |

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
├── AGENTS.md                           # the andes block (= andes-init template) + maintainer notes
├── CLAUDE.md                           # exactly "@AGENTS.md"
├── .claude/commands/, .github/prompts/ # maintainer-only /repo-audit and /ngrx-signals-sync (not shipped)
├── .claude/settings.json               # maintainer settings (enables andes-core, andes-github)
├── .github/workflows/repo-audit.yml    # CI
├── scripts/repo-audit.mjs              # structural audit
├── scripts/upstream-skills.lock.json   # hash pin for angular-developer
└── docs/                               # ADRs and change records
```

**Why this layout.**

- **Copilot uses Agent Plugins 1.0.** VS Code and Copilot CLI both switch to Agent Plugins 1.0 when a root `plugin.json` declares `"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`. Skills (`skills/`), MCP (`mcp.json`), and Copilot agents (`com.github.copilot/agents/`) sit at fixed locations, so that manifest has no path fields.
- **Claude Code uses its own files.** It reads `.claude-plugin/plugin.json`, `.mcp.json`, and the listed `claude-agents/` files.
- **Neither loads the other's agents.** Neither agent folder is a default `agents/` folder. The audit rejects `agents/`, `commands/`, `hooks/`, and `.github/` folders inside a plugin.

**Develop against live files.** Load a plugin from its folder instead of the marketplace cache:

```shell
claude --plugin-dir plugins/andes-<name>
```

**Bump versions on every change.** Installs are cached by version, so bump `version` in *both* manifests of every plugin you change. CI enforces this on PRs with `--base`.

**Keep copies in sync.**

- **Agent twins.** A Claude agent and its Copilot twin change together.
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

- **Checks:** `manifests`, `skills`, `harness-paths`, `agents`, `mcp`, `memory`, `testing-policy`, `registry`, `changelog`.
- **Exit codes:** `0` clean, `10` findings, `1` the script failed.
- **`/repo-audit`** runs the same checks inside Claude Code (use the `repo-audit` prompt in Copilot). It is report-only unless you pass `--fix`, which applies only mechanical repairs and never commits.

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

---

## Docs

- [docs/2026-09-plugin-architecture.md](docs/2026-09-plugin-architecture.md) is the ADR for this layout. It covers verification results, the Copilot checklist, and fallbacks.
- The `docs/2026-08-*.md` files record earlier decisions. Parts of them are superseded by the ADR.
- [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
