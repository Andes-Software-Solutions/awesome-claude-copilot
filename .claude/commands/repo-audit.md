---
description: Audit the andes plugin marketplace (manifests, skills, agents, MCP, AGENTS.md block, testing policy); report findings and optionally fix mechanical drift.
argument-hint: "[--fix] [--strict] [--base=<ref>]"
allowed-tools: Bash(node:*), Bash(git status:*), Bash(git diff:*), Bash(claude plugin validate:*), Read, Edit, Glob, Grep
---

Audit the plugins under `plugins/` against the marketplace's contracts: both harness manifests, skills, agent naming and review rules, MCP scoping, the shared AGENTS.md block, and the .NET testing policy.

The deterministic work lives in `scripts/repo-audit.mjs` — it parses manifests and frontmatter, compares the AGENTS.md block with the `andes-init` template, and prints a JSON report. Your job is only to act on what it flags.

## 1. Run the audit

```bash
node scripts/repo-audit.mjs --json
```

Append `--strict` if the user passed it (warnings then also fail) and `--base=<ref>` if they passed one (every plugin changed since `<ref>` must bump its version). Then run `claude plugin validate .` when the `claude` CLI is available.

## 2. Branch on the exit code — it is the contract

- **`0` — clean.** Print the one-line summary (it carries the warning count) and **stop immediately**. Do not read files or "double-check" — this is the routine path and should cost close to nothing.
- **`1` — the script itself failed** (bad JSON, missing git ref). Report the error and stop. Fix nothing on the basis of a failed check.
- **`10` — findings.** Continue below.

## 3. Read only what the report names

`affectedPaths` is your entire read-set. Per finding family:

- **`manifests/*`** — make the Claude and Copilot manifests agree (name = folder, same version and description); list every `claude-agents/*.md` file in the Claude manifest; fix marketplace entries. `version-bump`: bump the patch version in both manifests of that plugin.
- **`skills/*`** — frontmatter `name` must equal the folder; add a trigger-style description; remove leftover `paths:` / `applyTo:`. `upstream-drift`: revert local edits to the vendored skill — never "fix" it by editing the hash.
- **`harness-paths/*`** — replace `.claude/...` / `.github/skills|instructions` / `copilot-instructions.md` references with the skill or agent name.
- **`agents/*`** — `name` must equal the file stem (`andes-...`); reviewers keep High/Medium only, no handoffs, `agents:`, edit or Agent tools; list exact MCP tools; align models to the parity table in `scripts/repo-audit.mjs`, or — only with the user's explicit approval — record a documented override in `modelParityOverrides`.
- **`mcp/*`** — pin the server version or image tag; keep the required flags (`--read-only`, `--toolsets=registry`).
- **`memory/*`** — edit `plugins/andes-core/skills/andes-init/assets/agents-block.md`, then copy it verbatim between the markers in `AGENTS.md` and copy its `## Review loop` section verbatim into the Copilot implementer agents. `budget` is a warning: propose trims, never apply them under `--fix`.
- **`testing-policy/*`** — rewrite the line to the xUnit + NSubstitute policy, or phrase it as a prohibition.
- **`registry/*`** — add the missing README or AGENTS.md mention; lift wording from the item itself.

## 4. Report, or fix mechanically

- **Default (no `--fix`):** output a findings table — severity, finding, proposed exact edit — and stop. Edit nothing.
- **With `--fix`:** apply **only the mechanical repairs** above (manifest sync, name/frontmatter fixes, verbatim block/section copies, version bumps, registry lines). Everything judgment-shaped stays in the report.

## 5. Confirm

Re-run `node scripts/repo-audit.mjs`. The errors you fixed must be gone; explain any finding you deliberately left.

## 6. Leave the diff for review

**Do not commit, do not push, do not open a PR.** This repo *is* the guidance, and a silently wrong "repair" would surface weeks later as drifted standards. `git diff` is the review surface and `git checkout --` is the undo; a human decides.
