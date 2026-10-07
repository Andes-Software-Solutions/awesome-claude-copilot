# Maintainer MCP servers and no self-install

**Date:** 2026-09-29. **Status:** accepted. This record supersedes the "No root configs" bullet in [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md). That bullet removed the root `.mcp.json` because the plugins started their own servers. The rest of that record is unchanged. Amended by [2026-10-microsoft-learn-in-core.md](2026-10-microsoft-learn-in-core.md): `microsoft-learn` is now copied from `andes-core`.

## Why

This repository builds the `andes` marketplace. Installing the marketplace here loads cached copies of the plugins alongside the live files under `plugins/`, so a session could follow an older version of a skill than the one being edited. Changes are tested with `claude --plugin-dir plugins/andes-<name>` instead, which loads the live files.

Without installed plugins, the servers they ship do not start. Maintainers still need current documentation to write and review the standards: .NET and Azure, Angular, other libraries, Terraform providers, and the Azure DevOps backlog. The repository therefore starts those servers itself.

This repository is maintained with Claude Code only, so the root `.mcp.json` is the only config it needs. `.vscode/mcp.json` stays banned.

## What shipped

- **Root `.mcp.json`** declares these servers:

  | Server | Copied from | Needs |
  | --- | --- | --- |
  | `microsoft-learn` | `andes-dotnet` | — |
  | `angular-cli` | `andes-angular` | Node.js |
  | `context7` | `andes-core` | — |
  | `azure-devops` | `andes-azure-devops` | Node.js, `ADO_ORG`, `az login` |
  | `terraform` | `andes-terraform` | Docker |

  Each entry is a verbatim copy of the plugin's `.mcp.json` entry, including the pins and the restricting flags (`--read-only`, three Azure DevOps domains, `--toolsets=registry`). Claude Code asks each maintainer to approve project servers on first use.
- **`.claude/settings.json`** drops `extraKnownMarketplaces.andes`. It already enabled no `*@andes` plugin.

## Audit rules

- **`mcp/root-missing`** fails when the root `.mcp.json` does not start a server listed in `maintainerMcpServers`.
- **`mcp/root-drift`** fails when a root entry differs from the plugin entry it copies. The plugin is the source of truth: bump a pin there, then copy the entry.
- **`mcp/root-config`** now fails only on `.vscode/mcp.json`.
- **`registry/self-install`** fails when `.claude/settings.json` registers the `andes` marketplace or enables an `*@andes` plugin.

## Tool names

With the servers started from the root file, maintainer sessions see them as `mcp__<server>__<tool>`, for example `mcp__context7__query-docs`. The shipped agents keep their plugin-qualified grants (`mcp__plugin_andes-core_context7__query-docs`), because consumers get the servers from the plugins.
