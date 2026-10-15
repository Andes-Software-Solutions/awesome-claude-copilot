# Copilot technical writer on Claude Haiku 5.5 at `medium` effort

**Date:** 2026-10-14. **Status:** accepted. Amends [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md) D4 (the writer had no effort key) and the Haiku pair in [2026-09-copilot-model-ids.md](2026-09-copilot-model-ids.md).

## Why

The Copilot `andes-se-technical-writer` ran on Claude Haiku 4.5 because its work is template-driven and the cheapest tier is enough. Haiku 4.5 had no configurable reasoning, so the agent carried no `reasoning-effort` key and ran at whatever level the session used.

Claude Haiku 5.5 is generally available in Copilot CLI and VS Code with configurable reasoning. It costs less than Haiku 4.5 and the level can now be pinned where the work is defined.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-core` | 1.14.0 | `andes-se-technical-writer` (Copilot) pins `model: [claude-haiku-5.5, Claude Haiku 5.5 (copilot)]` and `reasoning-effort: medium` |
| Repository | 1.14.0 | `scripts/repo-audit.mjs`: `copilotEffort['andes-se-technical-writer']` null → `medium`; `modelParity.haiku` and `modelParityOverrides['andes-se-technical-writer'].copilot` → the Haiku 5.5 pair. README: Copilot CLI floor 1.0.85 → 1.0.94 |

The Claude twin is unchanged (`sonnet`, `effort: high`).

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Move the writer to Claude Haiku 5.5 | Under 100K input it costs $0.10 / $0.50 per 1M tokens (input / output), a tenth of Haiku 4.5 and one-twentieth of Claude Sonnet 5.5. Above 100K input it costs $0.50 / $2.50, half of Haiku 4.5. |
| D2 | Pin `reasoning-effort: medium` | `medium` is Haiku 5.5's default. The work is template-driven, but a design record must reconcile a diff with existing docs. Haiku 5.5 keeps thinking blocks from earlier turns in context, so a higher level grows context as well as output. `low` and `high` were the alternatives; `medium` was chosen as the default that bounds retained thinking. |
| D3 | Pin rather than inherit | A session raised to `high` or `xhigh` would otherwise inflate the writer. |
| D4 | Copilot CLI floor 1.0.94 | 1.0.94 added Claude Haiku 5.5. The CLI dispatches on the first `model` entry only and fails when it is unknown (see [2026-09-copilot-model-ids.md](2026-09-copilot-model-ids.md)), so older CLIs cannot run the writer. The floor applies to every agent: the README states one floor. |
| D5 | The override stays | The writer's Claude twin is `sonnet`, while its Copilot side is Haiku. `modelParityOverrides` keeps the Copilot pair, with the reason "template-driven docs; Haiku 5.5 costs ~1/20 of Sonnet 5.5 on AI Credits under 100K input; medium bounds retained thinking". |
| D6 | The Claude twin keeps `sonnet` / `effort: high` | The change targets Copilot's token billing. |

## Cost

Copilot prices per 1M tokens on 2026-10-14:

| Model | Input | Cached input | Output |
| --- | --- | --- | --- |
| Claude Haiku 5.5, input ≤ 100K | $0.10 | $0.01 | $0.50 |
| Claude Haiku 5.5, input > 100K | $0.50 | $0.05 | $2.50 |
| Claude Haiku 4.5 | $1.00 | $0.10 | $5.00 |
| Claude Sonnet 5.5 | $2.00 | $0.10 | $10.00 |
| Claude Opus 5.5 | $4.00 | $0.20 | $20.00 |

Haiku 5.5's tokenizer counts about 30% more tokens than Haiku 4.5's for the same text. The per-token price drop still outweighs it.

## Audit rules

No new rules. These existing rules now enforce the pin:

| Rule | Severity | Fails when |
| --- | --- | --- |
| `agents/effort` | error | The writer's `reasoning-effort` is not `medium` |
| `agents/model-format` | error | The writer's `model` is not the Haiku 5.5 pair |
| `agents/model-parity` | error | A Haiku-tier agent's pair differs from `modelParity.haiku`, apart from the writer's override |

## Not verified

- **A Copilot CLI dispatch on `claude-haiku-5.5` at `medium`.** It needs AI Credits and was not run.
- **The VS Code display name.** `Claude Haiku 5.5 (copilot)` follows the pattern of the other pairs.
- **The cloud agent reading `reasoning-effort`.** Unchanged from [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md).
- **Token use per level.** No measurement exists.

## References

- Copilot CLI changelog, 1.0.94: <https://github.com/github/copilot-cli/blob/main/changelog.md>
- Supported models, Claude Haiku 5.5 and configurable reasoning: <https://docs.github.com/en/copilot/reference/ai-models/supported-models#models-with-extended-capabilities>
- Models and pricing: <https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing>
- What's new in Claude Haiku 5.5 (retained thinking blocks, tokenizer, effort default): <https://platform.claude.com/docs/en/models/haiku-5-5/whats-new-haiku-5-5>
