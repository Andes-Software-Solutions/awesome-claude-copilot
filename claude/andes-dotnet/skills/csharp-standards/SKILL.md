---
name: csharp-standards
description: "Use when writing, editing, or reviewing any C# (.cs) code: C# 14 idioms, naming, the mandatory file layout (interface members, then Private methods / Public static methods / Logging regions), primary constructors, collection expressions, var, sealed, TimeProvider, LoggerMessage logging, nullability, credentials and security, and Minimal APIs + FluentValidation."
---

# C# Development

## Do first

- Read the target framework (TFM), `<LangVersion>`, `global.json` SDK, `<Nullable>`, and repo config (`Directory.Build.*`, `Directory.Packages.props`). Don't change the TFM, SDK, or language version unless asked, and don't use C# features newer than the TFM default.
- Follow the project's conventions for anything these standards do not cover. Where they conflict with a non-negotiable below, apply the non-negotiable to new and changed code and flag the conflict; migrate existing code only when asked.
- Other skills own their topics; follow them rather than restating them here:

  | Topic | Skill |
  | --- | --- |
  | Web APIs, Problem Details, the exception handler | `aspnet-rest-apis` |
  | Async, `Task`/`ValueTask`, cancellation | `csharp-async` |
  | XML doc comments | `csharp-docs` |
  | Tests and the database ladder | `csharp-xunit` |
  | EF Core (writes, retries, transactions, migrations) | `ef-core`, `ef-core-base-entities`, `ef-core-enum-reference-tables` |
  | Which project and folder a type goes in, and its name | `dotnet-api-architecture` |

## Non-negotiables

These apply to every new or changed file. Reviewers flag violations.

- Web APIs are **Minimal APIs only** — no MVC controllers, no `[ApiController]`. Validation is **FluentValidation only** — no DataAnnotations, no `AddValidation()` (`aspnet-rest-apis`).
- **Primary constructors** on every class that takes dependencies; capture each into a `private readonly` `_camelCase` field and use the field, not the parameter, in members.
- **Collection expressions** for every collection literal: `[]`, `[1, 2, 3]`, `[.. first, .. second]` — never `new List<T>()`, `new T[] { }`, or `Array.Empty<T>()`.
- **`var`** for every local whose initializer has a type: `var service = new OrderService(...)`, not `OrderService service = new()`. Spell the type out only where the initializer has none — collection expressions (`List<int> ids = [1, 2];`), `default`, `null`, and lambdas.
- **Logging through `[LoggerMessage]`** source-generated methods in the `Logging` region — never `_logger.LogInformation(...)` calls in method bodies.
- **No repository layer.** Services inject the EF Core `DbContext` and query it; never an `I<Entity>Repository`, a generic `IRepository<T>`, or a unit-of-work wrapper (`dotnet-api-architecture`).
- **The file layout below.**
- Tests: xUnit v3 + NSubstitute only (`csharp-xunit`).

## File layout

One type per file, with the two exceptions `dotnet-api-architecture` defines: an interface with its single implementation, and a validator with the type it validates. That skill also fixes the `Models/`, `Exceptions/`, and `Constants/` subfolders each folder sorts its types into. Members appear in exactly this order; a region exists only when it has members, and the regions always close the file.

1. Captured fields, constants, and properties — no region.
2. Interface implementations, in the interface's order — no region. Public instance members that no interface declares follow them.
3. `#region Private methods` — private instance and private static helpers.
4. `#region Public static methods`.
5. `#region Logging` — the `[LoggerMessage]` partial methods. A class that logs is `partial`.

```csharp
public sealed partial class OrderService(ContosoDbContext ctx, ILogger<OrderService> logger) : IOrderService
{
    private readonly ContosoDbContext _ctx = ctx;
    private readonly ILogger<OrderService> _logger = logger;

    public async Task<OrderDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await _ctx.Orders
            .AsNoTracking()
            .Where(o => o.Id == id)
            .Select(OrderMapper.MapToOrderDtoExpression)
            .FirstOrDefaultAsync(cancellationToken);
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

    public static OrderService Create(ContosoDbContext ctx, ILoggerFactory factory) =>
        new(ctx, factory.CreateLogger<OrderService>());

    #endregion

    #region Logging

    [LoggerMessage(Level = LogLevel.Warning, Message = "Order {OrderId} was not found")]
    private static partial void LogOrderMissing(ILogger logger, Guid orderId);

    #endregion
}
```

Exempt: `static` `[McpServerToolType]` classes (instance tool classes follow the layout; `csharp-mcp-server`), records and DTOs with no methods, and generated code. StyleCop and `.editorconfig` settings that keep analyzers from fighting the layout: [references/editorconfig.md](references/editorconfig.md).

## Principles

- Target the latest C# the TFM allows (C# 14 on .NET 10: extension members, the `field` accessor, implicit `Span<T>` conversions, `?.=`, `nameof` on unbound generics).
- Honor `.editorconfig` ([references/editorconfig.md](references/editorconfig.md)). Prefer file-scoped namespaces, pattern matching, switch expressions, raw string literals, and `nameof(...)` over member-name literals.
- Classes are `sealed` unless designed for inheritance. Least exposure: `private` > `internal` > `protected` > `public`. Don't add interfaces or abstractions unless they sit at an external boundary or enable testing; don't wrap existing abstractions.
- Prefer records for DTOs. Keep user-facing strings in resource files.
- Read time from an injected `TimeProvider` (registered as `TimeProvider.System`), never `DateTime.UtcNow` / `DateTimeOffset.UtcNow`, so tests can control it.
- Builds treat warnings as errors (`<TreatWarningsAsErrors>`, `<AnalysisLevel>latest-recommended</AnalysisLevel>`) and pin versions centrally in `Directory.Packages.props`; keep an existing repo's settings and don't add suppressions to get green.
- Don't edit generated code (`*.g.cs`, `// <auto-generated>`). Don't add unused members or parameters. When fixing a method, check its siblings for the same issue.
- Comment only what code cannot say: why-decisions, constraints, non-obvious invariants. Never restate what the code does or narrate a change.
- Newline before every opening brace; the final `return` of a method on its own line.
- When reviewing, make only high-confidence suggestions.

## Naming

- PascalCase for types, methods, and public members; `I`-prefixed interfaces; `_camelCase` private fields; camelCase locals and parameters; `Async` suffix on async methods; `Log` prefix on `[LoggerMessage]` methods.

## Nullability

- Declare variables non-nullable; validate at entry points only with the throw helpers (`ArgumentNullException.ThrowIfNull(x)`, `ArgumentException.ThrowIfNullOrWhiteSpace(s)`, `ArgumentOutOfRangeException.ThrowIfNegative(n)`).
- Always `is null` / `is not null` — never `== null` / `!= null`. Trust the annotations; avoid blanket `!`.

## Errors and security

- Throw precise exception types, never base `Exception`. Catching `Exception` is fine (CA1031 is off, so no `#pragma` or suppression); catch it only where the failure is handled (logged, translated, or rethrown), never silently. Error responses come only from the one exception handler (`aspnet-rest-apis` `references/exception-handling.md`).
- Never log PII or secrets. Secrets live in Azure Key Vault or the environment, never in code or committed config.
- Azure credentials: `DefaultAzureCredential` for local development only; in Azure, `ManagedIdentityCredential` (or `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=ManagedIdentityCredential`), so production never falls through to a developer credential. Other skills defer to this rule.
- Resilient I/O: timeouts everywhere, retry with backoff where the operation is idempotent (`Microsoft.Extensions.Http.Resilience` for `HttpClient`).

## Logging and performance

- `[LoggerMessage]` methods carry structured properties (`{OrderId}`), never string interpolation; add scopes for correlation. OpenTelemetry where the app is hosted in Azure. No log spam.
- Simple first; optimize measured hot paths (streaming, `Span<T>`/`Memory<T>`, pooling). 12-factor configuration from the environment.

## Build

- Build and verify with `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes`.
