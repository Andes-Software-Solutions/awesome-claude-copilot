---
name: andes-init
description: "Install or refresh the shared Andes standards in this repository: writes the managed block in the root AGENTS.md (read by Claude Code and GitHub Copilot), wires CLAUDE.md to it, and offers opt-in settings and cleanup of old drop-in copies. Run on request only."
disable-model-invocation: true
---

# andes-init

Installs the Andes always-on standards into the current repository and keeps them current. Safe to re-run: a second run with nothing new changes nothing.

The template is `assets/agents-block.md` in this skill's own directory (resolve it relative to this `SKILL.md`, not the user's repo). Work from the repository root (`git rev-parse --show-toplevel`). Never touch text outside the `andes` markers, and never delete a file without the user's explicit yes.

## 1. AGENTS.md

Read the template. Then, in the repo root:

- **No `AGENTS.md`** → create it with the template as its entire content.
- **Exactly one `<!-- andes:begin … -->` … `<!-- andes:end -->` pair** → replace everything from the begin marker through the end marker with the template. If it is already identical, report "AGENTS.md is up to date".
- **No markers** → append a blank line and the template to the end of the file.
- **Anything else** (one marker without the other, several pairs, nested markers) → stop, show the user the marker lines found, and ask how to proceed. Do not guess.

## 2. CLAUDE.md

Claude Code reads `AGENTS.md` natively only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists — one personal `CLAUDE.local.md` silently turns it off. An `@AGENTS.md` import is immune to that and never loads the file twice.

- If `CLAUDE.md` or `.claude/CLAUDE.md` exists and neither contains a line that is exactly `@AGENTS.md`, add that line at the top of the one that exists (root first).
- If neither exists, create `CLAUDE.md` containing exactly `@AGENTS.md`.
- If `.github/copilot-instructions.md` exists, tell the user Copilot loads it **and** `AGENTS.md`; offer to move anything project-specific into `AGENTS.md` (outside the markers) and delete it. Never delete it without a yes.

## 3. Detect the stacks

From `git ls-files`: `*.csproj` / `*.sln` / `*.slnx` → `andes-dotnet`; `*.razor` → `andes-dotnet-wasm`; `angular.json` → `andes-angular`; `*.tf` → `andes-terraform`; `.github/workflows/*` → `andes-github`. `andes-core` is always included. Report which plugins match and which of them are not installed.

## 4. Opt-in settings

Plugins cannot ship settings, so offer these **one at a time**, show the exact diff, and apply only on a yes. Merge into existing JSON; never drop or reorder existing keys.

1. `.claude/settings.json` — team rollout for Claude Code:
   - `extraKnownMarketplaces.andes`: `{ "source": { "source": "github", "repo": "RorroRojas3/awesome-claude-copilot" } }`
   - `enabledPlugins`: `"<plugin>@andes": true` for each detected plugin
   - when `andes-angular` is enabled: `permissions.deny` gains `"mcp__plugin_andes-angular_angular-cli__ai_tutor"` (the Angular CLI server has no flag to drop its tutor tool; a bare-name deny removes it from context)
2. `.claude/settings.json` — `"effortLevel": "xhigh"` (the Andes default; costs more per turn — ask separately).
3. `.vscode/settings.json` — for Copilot in VS Code: `"chat.useAgentsMdFile": true`, `"chat.plugins.enabled": true`, and the marketplace `"RorroRojas3/awesome-claude-copilot"` added to `"chat.plugins.marketplaces"`.

## 5. Old drop-in copies

Earlier versions of these standards were copied into repositories. Look for, and list with paths:

- `.claude/rules/{csharp,aspnet-rest-apis,azure-functions-csharp,blazor-wasm,csharp-mcp-server,terraform}.md` and `.github/instructions/<same>.instructions.md`
- `.claude/agents/{csharp-code-reviewer,angular-code-reviewer,github-actions-reviewer,prd-generator,se-technical-writer}.md` and `.github/agents/*.agent.md` for the same roles plus `planner-expert`, `csharp-expert`, `angular-expert`, `full-stack-expert`, `csharp-dotnet-janitor`, `csharp-mcp-expert`
- `.claude/skills/<name>` or `.github/skills/<name>` for any skill an installed Andes plugin also ships
- `microsoft-learn`, `angular-cli`, `context7`, or `terraform` servers in `.mcp.json` / `.vscode/mcp.json` (the plugins start their own)
- `microsoft-docs@claude-plugins-official` in `enabledPlugins` (it starts a second Microsoft Learn server)

These load the same guidance twice or contradict the plugins. Offer to delete them as one batch; delete only on a yes.

## 6. Report

End with a short list: files created or changed, settings applied or declined, leftovers kept, and plugins still to install (`/plugin install <name>@andes` in Claude Code; the marketplace in Copilot CLI or VS Code).
