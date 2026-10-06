---
name: repo-audit
description: "Audit the andes plugin marketplace (manifests, skills, agents, MCP, hooks, AGENTS.md block, testing and C# policies, maintainer skills, Markdown links); report findings and optionally fix mechanical drift. Maintainer-only; run on request."
argument-hint: "[--fix] [--strict] [--base=<ref>]"
allowed-tools: Bash(node:*), Bash(git status:*), Bash(git diff:*), Bash(claude plugin validate:*), Read, Edit, Glob, Grep
---

Run only when the user invoked `/repo-audit`.

Audit the plugins under `claude/` and `copilot/` against the marketplace's contracts: both harness manifests and marketplaces, the isolation of each harness tree, the mirrored skills and scripts, skills, agent naming and review rules, the portability and reasoning-effort rules for Copilot agents, MCP scoping and grants, the hook files of both harnesses, the shared AGENTS.md block, the .NET testing policy, the C# non-negotiables, the maintainer skills in `.claude/skills/`, and every local link in the repository's Markdown.

The deterministic work lives in `scripts/repo-audit.mjs` — it parses manifests and frontmatter, compares the AGENTS.md block with the `andes-init` template, and prints a JSON report. Your job is only to act on what it flags.

## 1. Run the audit

```bash
node scripts/repo-audit.mjs --json
```

Append `--strict` if the user passed it (warnings then also fail) and `--base=<ref>` if they passed one (any plugin changed since `<ref>` requires a bump of the shared version). Then run `claude plugin validate .` when the `claude` CLI is available.

## 2. Branch on the exit code — it is the contract

- **`0` — clean.** Print the one-line summary (it carries the warning count) and **stop immediately**. Do not read files or "double-check" — this is the routine path and should cost close to nothing.
- **`1` — the script itself failed** (bad JSON, missing git ref). Report the error and stop. Fix nothing on the basis of a failed check.
- **`10` — findings.** Continue below.

## 3. Read only what the report names

`affectedPaths` is your entire read-set. Per finding family:

- **`manifests/*`** — make the Claude manifest (`claude/<name>/.claude-plugin/plugin.json`) and the Copilot manifest (`copilot/<name>/plugin.json`) agree (name = folder, same version and description). `version-lockstep`: set every manifest of every plugin to the highest version in `detail`. `claude-field`: remove the component key; Claude Code loads `agents/` and `hooks/hooks.json` by default. `marketplace-*`: both `.claude-plugin/marketplace.json` and `.github/plugin/marketplace.json` are named `andes`, list every plugin once with `source` `./claude/<name>` or `./copilot/<name>`, repeat the manifest description, and carry no `version`.
- **`isolation/*`** — judgment, never `--fix`: a file sits in the wrong harness tree. Move it to the tree that owns it, or delete it. `unexpected-entry` and `namespace-entry` list the allowed entries in `detail.allowed`. `tree-missing`: add the plugin to the other tree. `legacy-tree`: move what is left under `plugins/` into the trees. `root-marketplace`: delete the file; Copilot would read it before its own marketplace. `symlink`: replace the link with a copy.
- **`mirror/*`** — run `node scripts/sync-shared.mjs --from=<tree>` for the tree that holds the intended edit (`claude` unless the diff shows the edit was made under `copilot/`). When both copies changed, report it and sync nothing. `version-bump`: bump the shared patch version in both manifests of every plugin.
- **`skills/*`** — frontmatter `name` must equal the folder; add a trigger-style description; remove leftover `paths:` / `applyTo:`. `cli-unreachable`: remove `disable-model-invocation: true` (Copilot CLI cannot invoke such a skill — github/copilot-cli#4438) and guard in the body with "Run only when the user asked for …". `upstream-drift`: revert local edits to the vendored skill — never "fix" it by editing the hash.
- **`harness-paths/*`** — replace `.claude/...` / `.github/skills|instructions` / `copilot-instructions.md` references with the skill or agent name.
- **`agents/*`** — `name` must equal the file stem (`andes-...`); reviewers keep High/Medium only, no `agents:`, edit or Agent tools; list exact MCP tools; `description-budget` and `body-budget` are warnings: propose trims, never apply them under `--fix`; align models to the parity table in `scripts/repo-audit.mjs`, or — only with the user's explicit approval — record a documented override in `modelParityOverrides`. Copilot agents: no `target:` key, so they load in both VS Code and `github-copilot` (`target`); `model` is a `modelParity` pair, CLI slug first and VS Code display name second — Copilot CLI dispatches on the first entry only (`model-format`); `reasoning-effort` equal to the `copilotEffort` table, absent where the model has no configurable reasoning (`effort`), and never spelled `reasoningEffort` (`effort-key`); no `argument-hint`, and `handoffs` only on `andes-planner-expert` (`vscode-key`); no `vscode/*` tools (`vscode-tool`); plain aliases, never `execute/…` sub-tools (`alias-subtool`); `agents:` and the `agent` tool go together (`agent-tool-mismatch`); an `agents:` target must exist and must not carry `disable-model-invocation: true` (`target-ghost`, `target-not-invocable`); a handoff target must be a Copilot agent in the marketplace or the built-in `agent` (`target-ghost`); `andes-planner-expert` keeps `edit`, never gets `execute`, and its body states that its only writes are under `docs/plans/` (`planner-scope`). `required-mcp`: grant the listed MCP tool (for a Claude twin, `mcp__plugin_<plugin that ships the server>_<server>__<tool>`). `mcp-owner`: fix the plugin segment of a Claude MCP tool name to the plugin whose `.mcp.json` ships that server. `description-parity`: make the twin descriptions identical apart from the word PROACTIVELY.
- **`mcp/*`** — pin the server version or image tag (`unpinned`); keep `angular-cli` and `azure-devops` on `@latest` (`floating-suffix`); keep the required flags (`--read-only`, `--toolsets=registry`); `harness-drift`: make `.mcp.json` and `mcp.json` list the same servers, URLs, commands, args, headers, and env. `root-missing` / `root-drift`: copy the server entry from the plugin's `.mcp.json` into the root `.mcp.json` verbatim (the root file follows the plugin, never the reverse). `root-config`: delete `.vscode/mcp.json`; this repo is maintained with Claude Code.
- **`hooks/*`** — `copilot-missing` / `claude-missing`: add the other harness's file (`copilot/<name>/com.github.copilot/hooks/hooks.json` or `claude/<name>/hooks/hooks.json`). `harness-flag`: a Claude handler passes `--harness=claude` and a Copilot entry `--harness=copilot`. `claude-format`: each handler is `type: "command"` and runs `${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs`. `copilot-format`: `"version": 1`, and each entry has `type: "command"`, a numeric `timeoutSec`, and `bash` (`$PLUGIN_ROOT`) and `powershell` (`$env:PLUGIN_ROOT`) commands that run the same script. `harness-drift`: make each event pair in `hookEventMap` run the same scripts, or report an unmapped event — adding one to the map is judgment. `script-missing`: restore the script or fix the path. `script-imports`: judgment — rewrite the import with `node:` built-ins, because an installed plugin has no `node_modules`.
- **`links/*`** — `broken`: judgment, never `--fix` — correct the path or anchor to the file or heading that was meant, and report links whose target is gone. The audit skips upstream-pinned skills, `andes-init/assets/`, and the mirrored copies under `copilot/`. `checker-missing`: `scripts/check-links.mjs` failed to load; report the error.
- **`memory/*`** — edit `claude/andes-core/skills/andes-init/assets/agents-block.md`, sync it to `copilot/`, then copy it verbatim between the markers in `AGENTS.md` and copy its `## Review loop` section verbatim into the Copilot implementer agents. `budget` is a warning: propose trims, never apply them under `--fix`.
- **`testing-policy/*`** — rewrite the line to the xUnit v3 + NSubstitute policy, or phrase it as a prohibition.
- **`csharp-policy/*`** — rewrite the line to Minimal APIs / FluentValidation, or phrase it as a prohibition (the scan skips lines containing "never", "not", "no", "only", "avoid", "flag", …).
- **`registry/*`** — add the missing README or AGENTS.md mention; lift wording from the item itself. `legacy-commands`: move the command into `.claude/skills/<name>/SKILL.md` and delete `.claude/commands/` / `.github/prompts/` (prompt files never load in Copilot CLI). `maintainer-skill`: `name` = folder, add a description, remove `disable-model-invocation`, and rename a skill that shadows a plugin skill. `self-install`: remove the `andes` entry from `extraKnownMarketplaces` and every `*@andes` key from `enabledPlugins` in `.claude/settings.json`.

## 4. Report, or fix mechanically

- **Default (no `--fix`):** output a findings table — severity, finding, proposed exact edit — and stop. Edit nothing.
- **With `--fix`:** apply **only the mechanical repairs** above (manifest sync, name/frontmatter fixes, `target:` and tool-alias fixes, hook root variables and `--harness` values, a one-sided mirror sync, verbatim block/section copies, version bumps, registry lines). Everything judgment-shaped — rewording standards, choosing MCP grants, moving commands — stays in the report.

## 5. Confirm

Re-run `node scripts/repo-audit.mjs`. The errors you fixed must be gone; explain any finding you deliberately left.

## 6. Leave the diff for review

**Do not commit, do not push, do not open a PR.** This repo *is* the guidance, and a silently wrong "repair" would surface weeks later as drifted standards. `git diff` is the review surface and `git checkout --` is the undo; a human decides. Releases go through `/release`, never through this skill.
