# Copilot reasoning effort, both Copilot environments, and context trims

**Date:** 2026-09-29. **Status:** accepted. Supersedes [2026-08-effort-defaults.md](2026-08-effort-defaults.md) §4 (Copilot had no per-agent effort key) and [2026-09-copilot-harness-and-release.md](2026-09-copilot-harness-and-release.md) §1 (every Copilot agent declares `target: github-copilot`).

## Why

Copilot bills by token. Model tier and review rounds were already controlled, but reasoning effort was not: no Copilot agent carried an effort key, so each one ran at whatever level the session happened to use. A session raised to `xhigh` ran the backlog manager and the janitor at `xhigh` too.

Copilot CLI now reads a per-agent key, so the level can be set where the work is defined.

The same review measured the context each plugin adds and found it already well controlled. Four small reductions remained.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-core` | 1.3.1 | `reasoning-effort` on `andes-prd-generator`, `andes-planner-expert` (`high`) and `andes-full-stack-expert` (`medium`); `target` removed from all four Copilot agents; `andes-init` wording |
| `andes-dotnet` | 1.3.1 | `reasoning-effort` on `andes-csharp-code-reviewer` (`high`), `andes-csharp-expert` and `andes-csharp-dotnet-janitor` (`medium`); `target` removed; `dotnet-api-architecture` trimmed |
| `andes-angular` | 1.2.1 | `reasoning-effort` on `andes-angular-code-reviewer` (`high`) and `andes-angular-expert` (`medium`); `target` removed; the Claude reviewer no longer preloads `ngrx-signal-store` |
| `andes-github` | 1.0.3 | `reasoning-effort: high` on `andes-github-actions-reviewer`; `target` removed; both twins skip the hardening skill's report step |
| `andes-azure-devops` | 1.0.1 | `reasoning-effort: medium` on `andes-ado-backlog-manager`; `target` removed |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | The key is `reasoning-effort`, kebab-case | The Copilot CLI changelog uses this spelling. The CLI reference documents `reasoningEffort`, which a user reports is not applied on CLI 1.0.88 ([github/copilot-cli#4963](https://github.com/github/copilot-cli/issues/4963), open). |
| D2 | Effort is tiered by role, not mirrored from the Claude pins | A higher level consumes more AI Credits. `high` goes where a miss is expensive or the artifact feeds everything after it: the three reviewers, the PRD generator, the planner. `medium` goes where the work is scoped and gated by build, tests, and a `high` reviewer: the two implementers, the janitor, the backlog manager. |
| D3 | `andes-full-stack-expert` runs at `medium` | It runs the longest session on the most expensive model and executes a plan that already exists. |
| D4 | `andes-se-technical-writer` has no key | Claude Haiku 4.5 has no configurable reasoning. A level the model lacks is reported and left unapplied. |
| D5 | Claude `effort` pins are unchanged | Reviewers stay at `xhigh` and the rest at `high`. |
| D6 | Model tiers are unchanged | Claude Opus 5.5 costs twice Claude Sonnet 5.5 on input and output. The planner and the orchestrator keep it. |
| D7 | Copilot agents declare no `target` | GitHub defines an unset `target` as both environments, `vscode` and `github-copilot`. The agents keep one frontmatter shape for both: plain tool aliases, exact `server/tool` grants, no `handoffs`, `argument-hint`, or `vscode/*` tools. |
| D8 | The Claude Angular reviewer loads `ngrx-signal-store` on demand | The preload cost about 2,400 tokens on every round, including diffs with no store code. The Copilot twin already loaded it on demand. |
| D9 | `andes-github-actions-reviewer` skips hardening Step 7 and `references/report-format.md` | That file defines a five-level report. The reviewer reports two levels, so it read the file and then contradicted it. |
| D10 | `dotnet-api-architecture` lists under `## Never` only the bans stated nowhere else | Seven bullets restated Layering, the rules, or the decision table. Removing them saves 1,130 characters, about 280 tokens per load. |
| D11 | Size budgets are warnings | Nothing limited skill bodies, agent bodies, or agent descriptions. Each budget sits just above the largest file today. |

## Audit rules

| Rule | Severity | Fails when |
| --- | --- | --- |
| `agents/effort` | error | A Copilot agent's `reasoning-effort` differs from `CONFIG.copilotEffort`, the agent has no entry there, or the key is present where the table says it must be absent |
| `agents/effort-key` | error | A Copilot agent carries `reasoningEffort` |
| `agents/target` | error | A Copilot agent carries `target`. Before this change the rule required `target: github-copilot` |
| `agents/description-budget` | warning | An agent description passes 550 characters |
| `agents/body-budget` | warning | An agent body passes 12,000 characters |
| `skills/body-budget` | warning | A `SKILL.md` body passes 20,000 characters |

## Cost

Copilot prices per 1M tokens on 2026-09-29:

| Model | Input | Cached input | Output |
| --- | --- | --- | --- |
| Claude Haiku 4.5 | $1.00 | $0.10 | $5.00 |
| Claude Sonnet 5.5 | $2.00 | $0.20 | $10.00 |
| Claude Opus 5.5 | $4.00 | $0.20 | $20.00 |

One output token costs as much as 50 cached input tokens on Claude Sonnet 5.5 and 100 on Claude Opus 5.5. Reasoning effort is therefore a larger lever than context size.

The pins act as a floor and a ceiling. Copilot CLI defaults to `medium`:

- **Session at `medium`.** The five `high` agents cost more than before. The other six are unchanged.
- **Session above `medium`.** The five `medium` agents cost less than before.

Always-on tokens per plugin, measured with `claude --plugin-dir plugins/<name> plugin details <name>` on Claude Code 2.1.207. The figures cover skills only:

| Plugin | Tokens |
| --- | --- |
| `andes-core` | ~316 |
| `andes-dotnet` | ~1,517 |
| `andes-dotnet-wasm` | ~126 |
| `andes-angular` | ~507 |
| `andes-github` | ~278 |
| `andes-terraform` | ~98 |
| `andes-azure-devops` | ~138 |

Left unchanged on purpose:

- **Reviewer checklists.** They repeat parts of the skills, but they focus the review.
- **Skill descriptions over 300 characters.** They drive routing, and trimming all nine saves about 125 tokens.
- **MCP tool schemas.** The Agent Plugins `mcp.json` schema has no tool filter.

## Not verified

- **Copilot coding agent and github.com.** The custom-agents reference lists no effort key. Whether the cloud agent reads `reasoning-effort` from an agent profile is unknown.
- **VS Code.** The agents load there because they declare no `target`. Installing the plugins, loading their skills, and starting their MCP servers in VS Code are untested.
- **Token use per level.** No measurement exists yet. To produce one, review the same diff with and without the pin on Copilot CLI and compare the per-model totals from `/usage`.
- **Reasoning billed as output under AI Credits.** Anthropic bills thinking as output tokens. GitHub's billing pages do not state it.

## Requirements

Copilot CLI 1.0.88 or later applies the key both when the agent is selected with `/agent` and when it is dispatched as a subagent. An explicit `--reasoning-effort` flag, a per-call value, or a `subagents` override in the user's settings takes precedence over the agent definition.

## References

- Copilot CLI changelog, 1.0.66 and 1.0.88: <https://github.com/github/copilot-cli/blob/main/changelog.md>
- Copilot CLI command reference, custom agent frontmatter fields: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
- Custom agents configuration (`target`): <https://docs.github.com/en/copilot/reference/custom-agents-configuration>
- Supported models, configurable reasoning: <https://docs.github.com/en/copilot/reference/ai-models/supported-models#models-with-extended-capabilities>
- Models and pricing: <https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing>
