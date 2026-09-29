# Azure DevOps plugin: `andes-azure-devops`

**Date:** 2026-09-28. **Status:** accepted. Extends [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) §6 (servers ship with plugins, exact grants) and reuses the `andes-prd-generator` report-contract pattern.

## Why

Teams on Azure Boards had no path from a PRD, or from a conversation, to their backlog: `prd/references/github-issues.md` covers GitHub only. Backlog writes carry commitments — an assignee and a sprint — so an agent that makes them must never guess those two answers and must never write without an explicit approval of what it previewed.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-azure-devops` | 1.0.0 | the `azure-devops` MCP server, the `andes-ado-backlog-manager` agent (Claude + Copilot twin), the `azure-devops-init` skill and its `## Azure DevOps` section template |
| `andes-core` | 1.3.0 | block `v1.3.0` routes backlog work to the agent; `andes-init` lists `azure-devops` among the servers to remove from repo-level MCP config and hints at the plugin |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Local stdio server `npx -y @azure-devops/mcp@2.10.0 ${ADO_ORG} -d core work work-items --authentication azcli` | The hosted `https://mcp.dev.azure.com/{organization}` server needs a per-tenant Microsoft Entra app registration and an `oauth.clientId` in Claude Code, which a plugin cannot ship. Pinned (`@2.10.0`); the organization is the required positional argument, so it comes from `${ADO_ORG}`, which Claude Code expands in `.mcp.json` args. |
| D2 | Three domains, no `search` | `core` (projects, teams, identities), `work` (iterations), `work-items`. `wit_query` → `wiql` covers lookup, and `search` would also load code and wiki search. `test-plans`, `repositories`, `pipelines`, `wiki`, and `advanced-security` never load. |
| D3 | `--authentication azcli`, hardcoded | `interactive` opens a browser sign-in a headless subagent cannot complete; `pat` / `envvar` put secrets in env. A `${VAR:-default}` in args would be a second unverified expansion on Copilot. Multi-tenant users add `--tenant` when registering manually. |
| D4 | Audit: `requiredMcpArgs`, new `forbiddenMcpArgs`, `requiredMcpGrants`, `forbiddenMcpTools` | `-d` is additive, so a required-arg check alone cannot stop `test-plans` being appended; the forbidden-arg rule closes that. `wit_work_item_attachment`, `work_iteration_write`, and `work_capacity_write` are exposed but never granted. |
| D5 | Removal = `wit_work_item_write` `update` → `System.State = Removed`, after `wit_work_item` → `get_type` confirms the state exists | The server has no delete tool. `Removed` is not supported on the Basic process and is absent from CMMI by default, so the agent checks the type's states rather than the process name, and reports rows it cannot remove. |
| D6 | PRD mapping: PRD → Epic, `EP-n` → Feature, `US-xxx` → story type; Basic: `EP-n` → Epic, `US-xxx` → Issue | Gives the three-level hierarchy; overridable by the section's `PRD mapping` line or the invocation; the preview table exposes it for veto in the one `NEEDS-INPUT` round. |
| D7 | The `## Azure DevOps` section is heading-delimited, with no markers | A second marker family would trip `andes-init`'s "one marker without the other → stop and ask" rule. The heading is unique, the refresh rule (heading → next `## ` or EOF) is deterministic, and the team can hand-edit people and conventions. An HTML comment under the heading records ownership. |
| D8 | Agent tools: `Read`, `Glob`, `Grep` plus ten exact MCP tools; no `Write`, `Edit`, or `Bash` | It reads `AGENTS.md` and `docs/prd/*.md` and writes only to Azure DevOps; `az` is never called because the server authenticates. Copilot twin: `read`, `search`, `azure-devops/<tool>`. |
| D9 | `sonnet` / `effort: high` ↔ `Claude Sonnet 5.5 (copilot)` | Non-reviewer parity; no override. |
| D10 | The init skill may call the ADO tools itself (main session) to offer projects, teams, and iterations; the agent never does discovery on the user's behalf | Keeps the agent's `NEEDS-SETUP` rule hard and the setup path friendly. |

## Report contract

`ADO-STATUS: NEEDS-SETUP | NEEDS-INPUT | APPLIED | REPORTED`. Preview mode never writes; apply mode requires the invocation to state that the user approved the previewed plan and to name the assignee (from the configured people only) and the iteration. Q1 (assignee) and Q2 (iteration) are never defaulted; Q3+ carry an "If unanswered, I will assume" default and allow one round-trip.

## Field mapping

| Source | Field | Rule |
| --- | --- | --- |
| Title | `System.Title` | `{PRD-ID}: {title}` from a PRD; configured prefix first |
| Story statement, estimate, `From PRD: docs/prd/<slug>.md` | `System.Description` | Markdown via `format` |
| Acceptance criteria | `Microsoft.VSTS.Common.AcceptanceCriteria` | Markdown list; a Basic `Issue` has no such field → appended to the description |
| Assignee | `System.AssignedTo` | email of a configured person, resolved with `core_get_identity_ids` |
| Iteration | `System.IterationPath` | the chosen iteration's full path |
| Area | `System.AreaPath` | the configured area path, always |
| Tags | `System.Tags` | configured tags + feature slug + `P0` / `P1` / `P2` |
| Priority | `Microsoft.VSTS.Common.Priority` | P0 → 1, P1 → 2, P2 → 3 |
| Estimate | `Microsoft.VSTS.Scheduling.StoryPoints` (Agile) / `Effort` (Scrum, Basic) | only with a configured S/M/L → points mapping |
| Parent | `add_child`, or `link` parent | Epic → Feature → story |
| Depends on | `link` predecessor/successor | after both exist |

## Cost

| Measure | Value | Budget |
| --- | --- | --- |
| `azure-devops-init` description | 358 characters | 400 |
| Always-on block | 642 words (`v1.2.0`: 573) | 700 |
| Plugin skill tokens | to measure with `claude plugin details` | — |

## Verification

| Step | Result |
| --- | --- |
| `node scripts/repo-audit.mjs --strict` | clean: 7 plugins, 26 skills, 6 agent twins, 0 errors, 0 warnings (also with `--base=origin/main`) |
| `claude plugin validate --strict plugins/andes-azure-devops` | passed; the marketplace, `andes-dotnet`, and `andes-core` pass too |
| `claude --plugin-dir plugins/andes-azure-devops` with `ADO_ORG` set: `/mcp` lists only `core_*`, `work*`, `wit_*` tools | with `--plugin-dir plugins/andes-core` passed too (a plugin loaded without its dependency is skipped): the agent and the skill register, `${ADO_ORG}` expands, and the server connects over stdio in about 2 s with domains `core`, `work`, `work-items` and `azcli` (Claude Code 2.1.207) |
| Preview → approval → `APPLIED` → re-run yields `skip (exists #id)` | not run: needs a real organization and an `az login` session |

### Not yet verified: Copilot

Whether Copilot CLI expands `${ADO_ORG}` inside a plugin's `mcp.json` args is unverified (the Copilot coding agent documents `$VAR` / `${VAR}` substitution for `env` and `headers`). If the literal `${ADO_ORG}` reaches the server, `azure-devops-init` step 4 has the fallback: register the server manually under the same name, `azure-devops`, with the organization written out, so the agent's grants still resolve.

## Consumer follow-up

Install `andes-azure-devops`, set `ADO_ORG`, run `az login`, restart the harness, then run `azure-devops-init` once per repository. Re-run `andes-init` to pick up block `v1.3.0`.
