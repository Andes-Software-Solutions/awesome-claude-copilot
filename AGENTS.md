<!-- andes:begin v1.0.0 -->
# Andes engineering standards

Shared by Claude Code and GitHub Copilot. The `andes-init` skill manages this block and replaces it on refresh — put project-specific instructions outside the `andes` markers.

## Communication & comments

- Lead with the answer or the change; no preamble, no restating the request. Don't re-summarize what the user already saw — report only what changed or went wrong. Match length to substance.
- Comment only what code cannot say: why a decision was made, constraints, non-obvious invariants, workarounds with links. Never narrate what code does or what changed. XML doc comments on public APIs are API documentation, not comments.

## Load the standards before you edit

Detailed standards live in skills that load on demand. Load the matching skill before writing or reviewing code:

| Working on | Load |
| --- | --- |
| Any `*.cs` | `csharp-standards`, plus `aspnet-rest-apis` (web APIs), `azure-functions-csharp` (Functions), `csharp-mcp-server` (MCP servers), `ef-core` (EF Core), `csharp-async`, `csharp-docs` (public APIs) as the change needs |
| .NET tests | `csharp-xunit` — xUnit + NSubstitute only; never FluentAssertions, Shouldly, Moq, NUnit, or MSTest. Test databases: Testcontainers → SQLite in-memory → dedicated test database → EF Core InMemory as a last resort |
| `*.razor`, `*.razor.cs` | `blazor-wasm` |
| Angular code | `angular-standards`; `ngrx-signal-store` for any state; `angular-developer` references for depth |
| `*.tf` | `terraform-conventions` |
| `.github/workflows/*.yml`, `action.yml` | `github-actions-hardening`, plus `github-actions-efficiency` / `github-actions-runtime-upgrade-conventions` when relevant |
| Microsoft Agent Framework | `microsoft-agent-framework` |

Ground version-specific answers in the MCP servers when they are installed — `microsoft-learn` (.NET, Azure), `angular-cli` (Angular), `context7` (other libraries), `terraform` (providers, modules) — instead of memory.

## Review loop

After changing code, run the matching reviewer on the diff: `andes-csharp-code-reviewer` (C#, including Blazor), `andes-angular-code-reviewer` (Angular), `andes-github-actions-reviewer` (workflows, composite actions). Terraform has no reviewer — run `terraform fmt -check` and `terraform validate` instead.

1. Reviewers report only High and Medium findings plus a verdict. They never edit files or hand work back.
2. The implementer fixes every reported finding, then runs the reviewer once more on only the files changed since round 1.
3. Two rounds maximum. If High findings remain after round 2, stop and report them to the user instead of iterating; list any open Medium findings in the final summary.
4. After a passing verdict (**Approve** or **Approve with changes**), invoke `andes-se-technical-writer` to update `docs/` and add the `CHANGELOG.md` entry — unless your caller said it handles documentation.

## Docs, changelog & requirements

- `andes-se-technical-writer` owns `docs/` and the root `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)): one reader-facing entry per PR under `## [Unreleased]` in the matching subsection. Routine cleanups with no behavior change still get a one-line entry.
- To write a PRD, spec a feature, or break it into epics and user stories, delegate to `andes-prd-generator` (writes `docs/prd/`). If its report starts `PRD-STATUS: NEEDS-INPUT`, show its questions to the user verbatim and re-invoke it with the answers. It creates GitHub issues only after the user explicitly approves. PRDs get no changelog entry; implementation plans reference their story IDs (`US-xxx`).
<!-- andes:end -->

## Maintaining this repository

This repository is the `andes` plugin marketplace; the block above is also what `andes-init` installs in consumer repositories.

- Plugins live in `plugins/andes-<name>/`: shared `skills/`; Claude Code reads `.claude-plugin/plugin.json` (each `claude-agents/*.md` listed), `.mcp.json`, and `claude-agents/`; Copilot reads the Agent Plugins 1.0 root `plugin.json`, `mcp.json`, and `com.github.copilot/agents/`. The marketplace is `.claude-plugin/marketplace.json`.
- Edit the block in `plugins/andes-core/skills/andes-init/assets/agents-block.md`, then copy it verbatim between the markers above. The `## Review loop` section is also copied verbatim into the Copilot implementer agents.
- A Claude agent and its Copilot twin change together. Bump `version` in both manifests of every plugin you change — installs are cached by version.
- Never edit `plugins/andes-angular/skills/angular-developer/` (vendored upstream, hash-pinned in `scripts/upstream-skills.lock.json`). Refresh `ngrx-signal-store` with `/ngrx-signals-sync`.
- Before committing, run `/repo-audit` (or `node scripts/repo-audit.mjs`) and `claude plugin validate .`. Develop against live files with `claude --plugin-dir plugins/andes-<name>`.
