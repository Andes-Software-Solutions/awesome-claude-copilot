# Copilot agent model IDs: CLI slug and VS Code display name

**Date:** 2026-09-29. **Status:** accepted.

## Why

Every Copilot agent pinned a VS Code display name, such as `model: Claude Sonnet 5.5 (copilot)`. Copilot CLI names models by slug instead: `--model`, `copilot help config`, `/subagents` settings, and session logs all use `claude-sonnet-5.5`. The CLI slug uses a dot in the version. Anthropic API IDs use a hyphen (`claude-sonnet-5-5`), so the two are not interchangeable.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-core` | 1.3.2 | `model` pairs on `andes-prd-generator`, `andes-planner-expert`, `andes-full-stack-expert`, `andes-se-technical-writer` |
| `andes-dotnet` | 1.3.2 | `model` pairs on `andes-csharp-code-reviewer`, `andes-csharp-expert`, `andes-csharp-dotnet-janitor` |
| `andes-angular` | 1.2.2 | `model` pairs on `andes-angular-code-reviewer`, `andes-angular-expert` |
| `andes-github` | 1.0.4 | `model` pair on `andes-github-actions-reviewer` |
| `andes-azure-devops` | 1.0.2 | `model` pair on `andes-ado-backlog-manager` |

The pairs are:

| Tier | `model` |
| --- | --- |
| Sonnet | `[claude-sonnet-5.5, Claude Sonnet 5.5 (copilot)]` |
| Opus | `[claude-opus-5.5, Claude Opus 5.5 (copilot)]` |
| Haiku | `[claude-haiku-4.5, Claude Haiku 4.5 (copilot)]` |
| Fable (no agent uses it) | `[claude-fable-5.1, Claude Fable 5.1 (copilot)]` |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Pin both forms as a list | Each surface finds its native form. Lists are documented on Copilot CLI (1.0.83) and in VS Code. |
| D2 | CLI slug first | Copilot CLI 1.0.89 dispatches on the first entry only (see Findings). VS Code tries each entry in order, so it still reaches the display name. |
| D3 | Tiers and overrides are unchanged | Only the spelling changed. `modelParityOverrides` keeps the reviewer and writer overrides, now written as pairs. |
| D4 | `fable` maps to Claude Fable 5.1 | It is the current Fable model in the Copilot catalog. No agent pins it today. |

## Findings

Tested with Copilot CLI 1.0.89 on Windows, 2026-09-29, from session events in `~/.copilot/session-state/<id>/events.jsonl`.

- **Display names resolve on the CLI.** This has worked since 1.0.24 ("Custom agent model field now accepts display names and vendor suffixes from VS Code"). Before this change, every andes agent dispatched on its pinned model (`claude-sonnet-5.5`, `claude-opus-5.5`, `claude-haiku-4.5`) at its pinned effort.
- **A list resolves to its first entry.** A subagent pinned to `[claude-sonnet-5.5, Claude Sonnet 5.5 (copilot)]` ran on `claude-sonnet-5.5`, and the event recorded `taskModelSource: custom_agent_definition`.
- **The CLI does not fall back through the list.** The 1.0.83 changelog says the entries are "tried in order until one is available". In practice, `[claude-sonnet-9, Claude Sonnet 5.5 (copilot)]` failed the dispatch with "Model 'claude-sonnet-9' is not available", and a display name listed first failed the same way. An unknown scalar pin also fails the dispatch. So a list is no less safe than a scalar, but on the CLI only its first entry counts.
- **The CLI's printed model lists are incomplete.** `copilot help config` and the error above both omit `claude-sonnet-5.5`, yet the CLI dispatches on it, and its runtime catalog lists it as enabled.
- **An Auto session ignores `copilot -p --agent <name>`'s pin.** Auto routing picked the model for the whole run. The pin applies when the agent is dispatched as a subagent or selected interactively.
- **The Copilot desktop app ignores the pin.** Sessions the app starts with an explicit model stay on that model when an agent is selected. For example, `andes-csharp-expert` ran on Claude Haiku 4.5. Nothing in this repository can change that.

## Audit rules

| Rule | Severity | Fails when |
| --- | --- | --- |
| `agents/model-format` | error | A Copilot agent's `model` is not one of the `modelParity` or override pairs. This catches a scalar, a reversed order, a missing form, or a mistyped slug. It covers the Copilot-only agents, which have no twin to check against. |
| `agents/model-parity` | error | Unchanged, except that it now compares the whole pair against the Claude twin's tier |

## Not verified

- **Copilot coding agent and github.com.** The custom-agents reference types `model` as `string`. Whether the cloud agent accepts a list is unknown. github/copilot-cli#2133, where a list made the CLI refuse to load the agent, is still open, but 1.0.89 loads lists.
- **VS Code.** Whether it resolves the slug, or skips it and moves to the display name, is untested.
- **Fallback in later CLI versions.** If a later release makes list fallback work, the order still holds: the slug comes first.

## References

- Copilot CLI changelog, 1.0.24, 1.0.83, 1.0.89: <https://github.com/github/copilot-cli/blob/main/changelog.md>
- Custom agents configuration (`model`, `target`): <https://docs.github.com/en/copilot/reference/custom-agents-configuration>
- Copilot CLI command reference, custom agent fields: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
- VS Code custom agents (`model` as string or prioritized list): <https://code.visualstudio.com/docs/copilot/customization/custom-agents>
- github/copilot-cli#2133, list rejected: <https://github.com/github/copilot-cli/issues/2133>
- github/copilot-cli#1752, display name mismatch between the CLI and VS Code: <https://github.com/github/copilot-cli/issues/1752>
- Claude Sonnet 5.5 in GitHub Copilot: <https://github.blog/changelog/2026-09-28-claude-sonnet-5-5-in-github-copilot/>
- Claude Opus 5.5 in GitHub Copilot: <https://github.blog/changelog/2026-09-22-claude-opus-5-5-is-now-available-in-github-copilot/>
