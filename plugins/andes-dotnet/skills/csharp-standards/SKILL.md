---
name: csharp-standards
description: "Use when writing, editing, or reviewing any C# (.cs) code: C# 14 idioms, naming, the mandatory file layout (interface members, then Private methods / Public static methods / Logging regions), primary constructors, collection expressions, var, LoggerMessage logging, nullability, security, Minimal APIs + FluentValidation, and the xUnit v3 + NSubstitute policy."
---

# C# Development

## Do first

- Read the target framework (TFM), `<LangVersion>`, `global.json` SDK, `<Nullable>`, and repo config (`Directory.Build.*`, `Directory.Packages.props`). Don't change the TFM, SDK, or language version unless asked, and don't use C# features newer than the TFM default.
- Follow the project's conventions for anything these standards do not cover. Where they conflict with a non-negotiable below, apply the non-negotiable to new and changed code and flag the conflict; migrate existing code only when asked.
- Web/API standards live in `aspnet-rest-apis`; async detail in `csharp-async`; XML docs in `csharp-docs`; tests in `csharp-xunit`; EF Core in `ef-core`.

## Non-negotiables

These apply to every new or changed file. Reviewers flag violations.

- Web APIs are **Minimal APIs only** — no MVC controllers, no `[ApiController]`. Validation is **FluentValidation only** — no DataAnnotations, no `AddValidation()`. Details in `aspnet-rest-apis`.
- **Primary constructors** on every class that takes dependencies; capture each into a `private readonly` `_camelCase` field and use the field, not the parameter, in members.
- **Collection expressions** for every collection literal: `[]`, `[1, 2, 3]`, `[.. first, .. second]` — never `new List<T>()`, `new T[] { }`, or `Array.Empty<T>()`.
- **`var`** for every local whose initializer has a type: `var service = new OrderService(...)`, not `OrderService service = new()`. Spell the type out only where the initializer has none — collection expressions (`List<int> ids = [1, 2];`), `default`, `null`, and lambdas.
- **Logging through `[LoggerMessage]`** source-generated methods in the `Logging` region — never `_logger.LogInformation(...)` calls in method bodies.
- **The file layout below.**
- Tests: xUnit v3 + NSubstitute only (`csharp-xunit`).

## File layout

One type per file. Members appear in exactly this order; a region exists only when it has members, and the regions always close the file.

1. Captured fields, constants, and properties — no region.
2. Interface implementations, in the interface's order — no region. Public instance members that no interface declares follow them.
3. `#region Private methods` — private instance and private static helpers.
4. `#region Public static methods`.
5. `#region Logging` — the `[LoggerMessage]` partial methods. A class that logs is `partial`.

```csharp
public sealed partial class OrderService(IOrderRepository repository, ILogger<OrderService> logger) : IOrderService
{
    private readonly IOrderRepository _repository = repository;
    private readonly ILogger<OrderService> _logger = logger;

    public async Task<Order?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await _repository.FindAsync(id, cancellationToken);
        if (order is null)
        {
            LogOrderMissing(_logger, id);
        }

        return order;
    }

    #region Private methods

    private static bool IsOpen(Order order) => order.ClosedAt is null;

    #endregion

    #region Public static methods

    public static OrderService Create(IOrderRepository repository, ILoggerFactory factory) =>
        new(repository, factory.CreateLogger<OrderService>());

    #endregion

    #region Logging

    [LoggerMessage(Level = LogLevel.Warning, Message = "Order {OrderId} was not found")]
    private static partial void LogOrderMissing(ILogger logger, Guid orderId);

    #endregion
}
```

Exempt: `[McpServerToolType]` static tool classes (`csharp-mcp-server`), records and DTOs with no methods, and generated code. If the repository runs StyleCop, disable SA1124 (regions), SA1202 (public before private), and SA1204 (static before instance) in `.editorconfig` instead of breaking the layout.

## Principles

- Target the latest C# the TFM allows (C# 14 on .NET 10: extension members, the `field` accessor, implicit `Span<T>` conversions, `?.=`, `nameof` on unbound generics).
- Honor `.editorconfig`; recommend `csharp_style_var_for_built_in_types`, `csharp_style_var_when_type_is_apparent`, `csharp_style_var_elsewhere`, and `csharp_style_prefer_primary_constructors` set to `true`, and `dotnet_style_prefer_collection_expression` to `when_types_loosely_match`. Prefer file-scoped namespaces, pattern matching, switch expressions, raw string literals, and `nameof(...)` over member-name literals.
- Least exposure: `private` > `internal` > `protected` > `public`. Don't add interfaces or abstractions unless they sit at an external boundary or enable testing; don't wrap existing abstractions.
- Prefer records for DTOs. Keep user-facing strings in resource files.
- Don't edit generated code (`*.g.cs`, `// <auto-generated>`). Don't add unused members or parameters. When fixing a method, check its siblings for the same issue.
- Comment only what code cannot say: why-decisions, constraints, non-obvious invariants. Never restate what the code does or narrate a change. XML doc comments on every public API (`csharp-docs` skill).
- Newline before every opening brace; the final `return` of a method on its own line.
- When reviewing, make only high-confidence suggestions.

## Naming

- PascalCase for types, methods, and public members; `I`-prefixed interfaces; `_camelCase` private fields; camelCase locals and parameters; `Async` suffix on async methods; `Log` prefix on `[LoggerMessage]` methods.

## Nullability

- Declare variables non-nullable; validate `null` at entry points only (`ArgumentNullException.ThrowIfNull(x)`, `string.IsNullOrWhiteSpace(s)`).
- Always `is null` / `is not null` — never `== null` / `!= null`. Trust the annotations; avoid blanket `!`.

## Async

- Async end to end: never block with `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`; no `async void` outside event handlers; flow a `CancellationToken` through long-running and I/O work (`csharp-async` skill).

## Errors and security

- Throw precise exception types; never throw or catch base `Exception` without rethrowing; no silent catches.
- Centralize error handling and return errors as Problem Details (RFC 9457).
- Never log PII or secrets. Prefer `DefaultAzureCredential` with Azure Key Vault / Managed Identity over secrets in code or config.
- Resilient I/O: timeouts everywhere, retry with backoff where the operation is idempotent.

## Data access

- Use Entity Framework Core (`ef-core` skill); tests pick a provider from the database ladder in the `csharp-xunit` skill.
- Manage schema with migrations; avoid N+1 and over-fetching.

## Logging and performance

- `[LoggerMessage]` methods carry structured properties (`{OrderId}`), never string interpolation; add scopes for correlation. OpenTelemetry / Application Insights where the app is hosted in Azure. No log spam.
- Simple first; optimize measured hot paths (streaming, `Span<T>`/`Memory<T>`, pooling). 12-factor configuration from the environment.

## Testing

- Cover critical paths. xUnit v3 + NSubstitute only, named `MethodName_Scenario_ExpectedBehavior`, with no `// Arrange` / `// Act` / `// Assert` comments — see the `csharp-xunit` skill for the full policy and the database ladder.
- Build and test with `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes`.
