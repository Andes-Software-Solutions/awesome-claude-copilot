---
name: azure-devops-init
description: "Connect this repository to an Azure DevOps project for andes-ado-backlog-manager: asks for the organization, project, team, area path, process, iteration root, assignable people, and conventions, then writes or refreshes the Azure DevOps section of the root AGENTS.md after the andes block and explains the ADO_ORG variable and az login. Run on request only."
---

# azure-devops-init

Run only when the user asked for `azure-devops-init` (for example `/andes-azure-devops:azure-devops-init` in Claude Code or `/azure-devops-init` in Copilot CLI). Never start it on your own.

Writes the `## Azure DevOps` section that `andes-ado-backlog-manager` reads, and keeps it current. Safe to re-run: a second run with nothing new changes nothing.

The template is `assets/azure-devops-section.md` in this skill's own directory (resolve it relative to this `SKILL.md`, not the user's repo). Work from the repository root (`git rev-parse --show-toplevel`). Edit only that section of `AGENTS.md`; never touch the `andes` block or any other file.

## 1. Preconditions

- `AGENTS.md` exists at the root and contains an `<!-- andes:end -->` line → continue. Otherwise stop: tell the user to run `andes-init` first (`/andes-core:andes-init` in Claude Code, `/andes-init` in Copilot CLI) and re-run this skill.
- Exactly one `## Azure DevOps` heading, or none. Several → stop, show them, and ask how to proceed. Do not guess.
- If the `azure-devops` MCP tools answer in this session (`core_list_projects`), use them to offer choices below. If they do not, say so — the server is not running yet (plugin not installed, `ADO_ORG` unset, or no `az login`) — and continue with typed answers.

## 2. Ask

Ask as one block, prefilled from the existing section on a refresh:

1. **Organization** — the `{org}` in `https://dev.azure.com/{org}`. Then explain how the server finds it: the `azure-devops` MCP server reads `ADO_ORG` from the environment that starts Claude Code or Copilot CLI (Windows: `setx ADO_ORG <org>`, then open a new terminal; macOS and Linux: `export ADO_ORG=<org>` in the shell profile). It signs in with the Azure CLI session (`az login`; `az login --tenant <id>` when the organization lives in another tenant). `npx` needs Node.js 20 or later. Restart the harness after setting the variable.
2. **Project** — offer `core_list_projects` when available.
3. **Team (board)** — offer `core_list_project_teams`.
4. **Area path** — suggest `<Project>` or `<Project>\<Team>`.
5. **Process** — Agile (Epic → Feature → User Story), Scrum (Epic → Feature → Product Backlog Item), Basic (Epic → Issue), CMMI (Epic → Feature → Requirement), or an inherited process (name its three types). Hint: Project settings → Process. Note that Basic has no `Removed` state, so the agent cannot remove items there.
6. **Iteration path root** — default `<Project>`; confirm with `work` → `list_team_iterations` when available and show the current iteration as proof.
7. **Assignable people** — display name and email, one per line. These are the only people the agent may assign, and it always asks which one.
8. **Conventions (optional)** — title prefix, default tags, story-point mapping (`S=1, M=3, L=5`, or none), definition of done in one line, PRD mapping override (default: PRD → Epic, `EP-n` → Feature, `US-xxx` → the story type).

## 3. Write the section

- Fill the template; leave no placeholder; write `none` for an empty optional value.
- **Refresh:** replace from the `## Azure DevOps` line up to, but not including, the next line that starts with `## `, or to the end of the file. If the result is identical, report "AGENTS.md is up to date".
- **First write:** append at the end of the file after one blank line — always after `<!-- andes:end -->`; never insert inside the andes markers.
- Show the filled section and apply on a yes.

## 4. Copilot CLI

Copilot CLI expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` in a plugin server's arguments, so the plugin's `azure-devops` server usually receives the organization as the literal text `${ADO_ORG}`, and `/mcp` shows it failing. When the user runs Copilot CLI, give them this command to register the server under the same name, with the organization written out:

`copilot mcp add azure-devops --tools "*" -- npx -y @azure-devops/mcp@latest <org> -d core work work-items --authentication azcli`

Add `--tenant <id>` after `azcli` if `TF400813` appears. Keep the name `azure-devops`: the agent's tool grants resolve only through it. Then restart Copilot CLI and confirm with `/mcp` that `azure-devops` is connected.

## 5. Report

End with a short list: the section written or refreshed; whether `ADO_ORG`, `az login`, or a harness restart is still pending; and the next step — ask for `andes-ado-backlog-manager`.
