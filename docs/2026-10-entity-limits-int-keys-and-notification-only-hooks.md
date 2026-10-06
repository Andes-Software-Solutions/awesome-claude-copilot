# Entity limits, `int` keys, a floating Azure DevOps server, and notification-only hooks

**Date:** 2026-10-05. **Status:** accepted. This record amends [2026-09-persistence-layout-and-ef-core-entity-skills.md](2026-09-persistence-layout-and-ef-core-entity-skills.md) (base entities), [2026-09-azure-devops-plugin.md](2026-09-azure-devops-plugin.md) D1 (the server pin) and its open Copilot question, and [2026-09-notification-and-link-hooks.md](2026-09-notification-and-link-hooks.md) (the Stop and link-check hooks). All plugins move to 1.11.0.

## Decisions

### D1. An entity's limits live in `Common/Constants/<Feature>/<Entity>Limits.cs`

Every max length, min length, precision, and scale of an entity is a `public const int` on a static `<Entity>Limits` class, for example `OrderLimits.NumberMaxLength`. The class mirrors the entity's folder: `Entity/Orders/Order.cs` ↔ `Common/Constants/Orders/OrderLimits.cs`, and base classes use `Base/` (`BaseEnumEntityLimits`).

- **Why.** The EF configuration (`HasMaxLength`) and the request validator (`MaximumLength`) must agree on the same number. When each carries its own literal, a change to one turns a 400 into a database truncation error.
- **Why `Common`.** `Dto` references only `Common`, and `Repository` reaches `Common` through `Entity`. `Common` is the only project both sides can see. A holder next to the entity would force `Dto → Entity`, which breaks the layering.
- **Replaces** the earlier rule that banned a constants class for column lengths. A literal length, precision, or scale in a configuration or a validator is now the thing that is banned.

### D2. Base entities are generic over the key: `Guid` by default, `int` where it fits

`BaseEntity<TKey>`, `BaseCreatedEntity<TKey>`, and `BaseModifiedEntity<TKey>` take `TKey : struct, IEquatable<TKey>`, and every entity names its key: `Order : BaseModifiedEntity<Guid>`, `Country : BaseModifiedEntity<int>`. The configurations follow: `BaseModifiedEntityConfiguration<Order, Guid>`.

- **Interfaces for the interceptors.** `ChangeTracker.Entries<T>()` needs one type that covers every key, and an open generic cannot be that type. Each base file therefore pairs a non-generic interface with its class, interface first: `IBaseEntity`, `IBaseCreatedEntity`, `IBaseModifiedEntity`. This is the existing "interface with its single implementation" file rule, so the file names do not change.
- **No Guid shorthands.** Keeping a non-generic `BaseModifiedEntity` as an alias for `<Guid>` would have kept existing entities compiling, but it doubles the base classes and configurations. Naming the key on each entity is explicit and costs one edit per entity.
- **`int` trade-offs, written into the skill.** The database assigns an int id (an identity column), so `Id` is `0` until `SaveChangesAsync`. Sequential ids are guessable, so every endpoint authorizes the caller for the row. Under retry-on-failure, a replayed commit that had actually succeeded inserts a second row, where a Guid key would fail on the duplicate. Tables that might outgrow `int` use `Guid`.

### D3. The Azure DevOps server floats on `@latest`

The `azure-devops` server now runs `npx -y @azure-devops/mcp@latest`, like `angular-cli`. The audit's `floatingMcpServers` requires exactly that suffix (`mcp/floating-suffix`). The domain and authentication rules (`requiredMcpArgs`, `forbiddenMcpArgs`) are unchanged.

### D4. On Copilot CLI, the server is registered by hand

This answers the open question from the Azure DevOps record. Copilot CLI's plugin reference says it expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` in a plugin stdio server's `args`. It also expands `$VAR` / `${VAR}` in `env` values, but `@azure-devops/mcp` takes the organization only as a positional argument. The plugin's server therefore receives the literal `${ADO_ORG}` on Copilot CLI.

- **Kept:** the single plugin entry, which works on Claude Code.
- **Changed:** `azure-devops-init` step 4 now presents manual registration as the expected Copilot CLI step. The command is `copilot mcp add azure-devops --tools "*" -- npx -y @azure-devops/mcp@latest <org> -d core work work-items --authentication azcli`. Copilot's config requires `tools`, and the name must stay `azure-devops` for the agent's grants to resolve. `andes-ado-backlog-manager` names this as a likely `NEEDS-SETUP` cause.
- **Rejected for now:** a Node launcher that reads `ADO_ORG` from `env` and passes it on as the argument. It would rely only on documented expansions, but it adds a shipped script and an audit exemption for the root `.mcp.json`.

### D5. `andes-core` ships only the notification hook

The `Stop` / `agentStop` turn-finished notification and the `PostToolUse` / `postToolUse` link check are gone. `notify.mjs` drops its `stop` event and the `ANDES_NOTIFY=attention` mode: `off` silences it, and any other value notifies.

- **The link checker stays as maintainer tooling.** It moved to `scripts/check-links.mjs`, its hook mode was removed, and the audit's `links` check and CI still fail on broken Markdown links.
- **The cloud-agent copy is gone.** `andes-init` no longer installs `.github/hooks/andes-links.json` and `.github/hooks/andes/check-links.mjs`, and offers to delete them where an earlier version did.
- **Audit.** `hookEventMap` keeps only `Notification` / `notification`, so a Claude or Copilot hook on any other event fails `hooks/harness-drift`.

### D6. The dead `find_examples` grant is removed

The current Angular CLI MCP server no longer exposes `find_examples`: [angular.dev/ai/mcp](https://angular.dev/ai/mcp) lists `ai_tutor`, `devserver.*`, `get_best_practices`, `list_projects`, `onpush_zoneless_migration`, `run_target`, and `search_documentation`. Because the server floats on `@latest`, the grant could never resolve. It is gone from both `andes-angular-code-reviewer` twins, from `andes-angular-expert`, from the `andes-angular-expert` entry in `requiredMcpGrants`, and from the `angular-standards` and `ngrx-signal-store` workflows.

## Enforcement

- **Reviewers.** Both `andes-csharp-code-reviewer` twins load `dotnet-api-architecture` for a length, precision, or scale in a configuration or validator. A literal instead of `<Entity>Limits` is Medium.
- **Audit.** `mcp/floating-suffix` covers `azure-devops`, `hooks/harness-drift` allows only the notification pair, and `links/*` loads `scripts/check-links.mjs`.

## Not yet verified

- **Copilot CLI.** The `copilot mcp add azure-devops …` registration has not been run against a real organization, and it is not yet known whether the plugin's own `azure-devops` entry shadows the user-level one.
- **The notification hook** on Copilot CLI and Windows, as before.

## References

- Copilot CLI plugin reference, MCP variable expansion: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- Copilot CLI command reference, MCP server configuration: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
- Azure DevOps MCP server: <https://github.com/microsoft/azure-devops-mcp>
- Angular CLI MCP server tools: <https://angular.dev/ai/mcp>
- EF Core, generated values: <https://learn.microsoft.com/ef/core/modeling/generated-properties>
