# Agent effort rebalance: Opus reviewers on Claude, `high` everywhere

**Date:** 2026-11-16. **Status:** accepted. Amends [2026-08-effort-defaults.md](2026-08-effort-defaults.md) (Claude reviewers pin `xhigh`, superseded in part by [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md)) and [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md) D2, D3, and D5 (implementers at `medium`).

## Why

Two levers set how deep an agent reasons: the model tier and the effort level. The Claude reviewers pulled both unevenly. Two of them ran Sonnet at `xhigh`, so their depth came from the most expensive effort setting on a mid tier. Meanwhile the Copilot implementers ran at `medium`, which left the agents that write the code thinner than the agents that review it.

This change moves the reviewers' depth to the model tier, where Opus supplies it, and sets one effort level, `high`, across every agent that can configure it.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-dotnet` | 1.16.1 | Claude `andes-csharp-code-reviewer`: `model: sonnet` → `opus`, `effort: xhigh` → `high`. Copilot `andes-csharp-expert` and `andes-csharp-dotnet-janitor`: `reasoning-effort` `medium` → `high` |
| `andes-angular` | 1.16.1 | Claude `andes-angular-code-reviewer`: `model: sonnet` → `opus`, `effort: xhigh` → `high`. Copilot `andes-angular-expert`: `reasoning-effort` `medium` → `high` |
| `andes-github` | 1.16.1 | Claude `andes-github-actions-reviewer`: stays `opus`, `effort: xhigh` → `high` |
| `andes-core` | 1.16.1 | Copilot `andes-full-stack-expert`: `reasoning-effort` `medium` → `high` |
| Repository | 1.16.1 | `scripts/repo-audit.mjs`: `CONFIG.effort` is now `{ reviewer: 'high', other: 'high' }`; `copilotEffort` raises the four implementers to `high`; two new `modelParityOverrides` entries; README updated |

The Copilot reviewers are unchanged: Claude Sonnet 5.5 at `high`. `andes-ado-backlog-manager` and `andes-se-technical-writer` stay at `medium` on Copilot.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | The Claude C# and Angular reviewers move to Opus | A review is a read-and-judge task where a missed High finding costs a defect in the merged code. Opus supplies that depth through the model, not through a higher effort setting on a smaller one. The GitHub Actions reviewer already ran Opus. |
| D2 | Every Claude agent runs at `effort: high` | With depth coming from Opus, `xhigh` on the reviewers no longer buys a separate tier. One level removes the `reviewer` / `other` split in practice, though `CONFIG.effort` keeps both keys so the audit can tell them apart if they diverge again. |
| D3 | Copilot implementers move from `medium` to `high` | [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md) D2 set `medium` because a `high` reviewer gates the work. The implementers still decide structure and edge cases on the first pass, and each rework round the reviewer forces costs a full extra run. `high` aims to catch more before review. |
| D4 | `andes-full-stack-expert` follows the other implementers | D3 of the earlier record held it at `medium` because it runs the longest session on the most expensive model. It now runs at `high` with the rest. It is the largest cost increase of the four. |
| D5 | The backlog manager and the writer stay at `medium` | The backlog manager previews every change and waits for approval. The writer runs template-driven work on Haiku 5.5; see [2026-10-copilot-writer-haiku-5-5.md](2026-10-copilot-writer-haiku-5-5.md) D2. |
| D6 | The Claude reviewers' Copilot twins stay on Sonnet 5.5 | Opus costs twice Sonnet on both input and output tokens on Copilot AI Credits. The Copilot reviewers keep `high` effort, so the review still gets a deep pass at the Sonnet price. |
| D7 | Two new `modelParityOverrides` entries | The Claude C# and Angular reviewers now pin `opus`, while `modelParity.opus` would require their Copilot twins to pin Opus too. Each entry records `claude: 'opus'` and the Sonnet 5.5 pair, with the reason "deliberate: deepest review tier on Claude; Opus pricing not justified on Copilot AI Credits". The entry for `andes-github-actions-reviewer` already carried the same reason. |

## Cost

Copilot prices per 1M tokens are in [2026-10-copilot-writer-haiku-5-5.md](2026-10-copilot-writer-haiku-5-5.md#cost). An output token costs five times an input token on both Sonnet 5.5 and Opus 5.5, and Anthropic bills thinking as output (GitHub's billing pages do not say, see [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md#not-verified)), so effort moves cost more than context size does.

- **Copilot implementers.** Each run at `high` consumes more AI Credits than the same run at `medium`. The increase is largest for `andes-full-stack-expert`, which runs on Opus 5.5.
- **Claude reviewers.** The C# and Angular reviewers change from Sonnet at `xhigh` to Opus at `high`. The net change in spend depends on how much each configuration thinks, which is not measured.
- **Claude GitHub Actions reviewer.** Same model, lower effort, so it costs less than before.

## Audit rules

No new rules. These existing rules enforce the new pins:

| Rule | Severity | Fails when |
| --- | --- | --- |
| `agents/effort` | error | A Claude agent's `effort`, or a Copilot agent's `reasoning-effort`, differs from `CONFIG.effort` or `CONFIG.copilotEffort` |
| `agents/model-parity` | error | A Copilot twin's pin differs from `modelParity` or its `modelParityOverrides` entry, or an override records a Claude model the agent no longer pins |

## Not verified

- **Cost and quality effect.** No measurement exists of token use or review findings per effort level, or of Opus at `high` against Sonnet at `xhigh`. To produce one, review the same diff with each configuration and compare the totals from `/usage`.
- **Whether `high` on the implementers reduces review rounds.** This is the expectation behind D3, not an observed result.
