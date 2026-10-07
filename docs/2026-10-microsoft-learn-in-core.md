# Microsoft Learn ships with `andes-core`

**Date:** 2026-10-07. **Status:** accepted. Amends [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) (the `andes-dotnet` row of the plugin table) and [2026-09-maintainer-mcp-servers.md](2026-09-maintainer-mcp-servers.md) (the root `.mcp.json` now copies `microsoft-learn` from `andes-core`).

## Why

- **Learn covers more than .NET.** Azure (including Terraform `azurerm`), Azure DevOps, GitHub, and VS Code are documented there too. A repository with only `andes-terraform` or `andes-azure-devops` had no Learn grounding.
- **The core agents held grants that did nothing.** `andes-planner-expert`, `andes-prd-generator`, and `andes-se-technical-writer` are granted the Learn tools, but without `andes-dotnet` those grants pointed at a server that never started.
- **Same reasoning as Context7.** [2026-09-copilot-harness-and-release.md](2026-09-copilot-harness-and-release.md) §3 moved `context7` to `andes-core` for the same gap.

## Decisions

### D1. `microsoft-learn` ships with `andes-core`

- `claude/andes-core/.mcp.json` declares it as `type: http` and `copilot/andes-core/mcp.json` as `type: streamable-http`, both at `https://learn.microsoft.com/api/mcp`. `andes-dotnet` no longer ships any MCP files.
- Claude tool names become `mcp__plugin_andes-core_microsoft-learn__<tool>`, because the plugin segment names the plugin that ships the server (`agents/mcp-owner`). Copilot grants (`microsoft-learn/<tool>`) carry no plugin name and are unchanged.
- The root `.mcp.json` entry is unchanged. `mcp/root-drift` now compares it with `andes-core`.

### D2. `microsoft-docs` moves with it

The skill explains when to use Learn and when to use Context7 or the Aspire MCP server instead, across Azure, VS Code, GitHub, and Agent Framework. Both servers it relies on now ship with `andes-core`, so it does too.

## Consequences

- Every `andes-core` install starts the Learn server, including repositories with no Microsoft stack. It is remote and anonymous, so there is no pin to bump and no key to distribute.
- Consumers get the change on plugin update. A Claude permission rule a user saved under the old `andes-dotnet` tool name stops matching, so they are asked once more. Rerunning `andes-init` refreshes the `AGENTS.md` grounding line.
