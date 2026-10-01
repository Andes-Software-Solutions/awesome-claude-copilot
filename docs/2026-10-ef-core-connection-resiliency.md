# EF Core connection resiliency by default

**Date:** 2026-10-01. **Status:** accepted. This record extends [2026-09-services-own-data-access-and-scaffold.md](2026-09-services-own-data-access-and-scaffold.md).

## Decisions

### D1. Every relational registration retries

`<Provider>PersistenceConfiguration.cs` registers the DbContext with `UseSqlServer(cs, sql => sql.EnableRetryOnFailure())`, or `UseNpgsql(cs, npgsql => npgsql.EnableRetryOnFailure())` on PostgreSQL.

- **Why.** Azure SQL and managed PostgreSQL drop connections during failovers and throttling. Without an execution strategy, each of those transient faults reaches the caller as a 500. EF Core's provider strategies already know which error numbers are transient.
- **Provider defaults.** No arguments: 6 retries and a 30-second maximum delay. The values are not options in `<Provider>DbOptions`, because no measured case has asked for different ones yet.
- **Covered already.** `UseAzureSql` / `UseAzureSynapse` set up retry themselves (EF Core 9 and later). SQLite has no retrying strategy.

### D2. Explicit transactions run inside the execution strategy

With retry on, each query and each `SaveChangesAsync` is its own retriable unit. A transaction the app starts itself (`BeginTransactionAsync` or `TransactionScope`) outside the strategy throws `InvalidOperationException`.

- **Rule.** One `SaveChangesAsync` is already atomic and needs no transaction. A unit that spans several saves, or a save plus `ExecuteUpdateAsync` / `ExecuteDeleteAsync` / raw SQL, runs in `_ctx.Database.CreateExecutionStrategy().ExecuteAsync(...)`. Every read and write of the unit sits inside the delegate, which starts with `_ctx.ChangeTracker.Clear()` so that a retry replays the unit from a clean state.
- **Commit failures.** If the connection drops during commit, the outcome is unknown, and the strategy replays the unit as if it had rolled back. Client-generated Guid keys make a replay of a commit that actually succeeded fail on a duplicate key instead of inserting a duplicate row. This is Microsoft's "Option 1".
- **Buffering.** Retry buffers each result set, so large reads are paged, not streamed unbounded.

### D3. Test fixtures build options without retry

`csharp-xunit` isolates Testcontainers tests with a transaction rolled back per test, and a retrying strategy rejects that transaction. The fixture therefore builds its own `DbContextOptions` with the production provider call, minus `EnableRetryOnFailure()`. Two kinds of test cannot share the test's transaction: `WebApplicationFactory` tests, which keep the production registration and its retry, and tests of a service that opens its own transaction. Both delete the rows they create or use a fresh database per test class.

## Enforcement

- **Reviewers.** Both C# reviewer twins flag a `UseSqlServer` / `UseNpgsql` registration without `EnableRetryOnFailure()` as Medium. They flag `BeginTransaction(Async)` or `TransactionScope` outside the execution strategy as High, because it throws at runtime.
- **No audit rule.** `csharp-policy` matches single lines, and a registration spans several, so a line-based check would misfire.

## Not included

- **Retry exhaustion.** `RetryLimitExceededException` still reaches `GlobalExceptionHandler` as a 500. Mapping it to a 503 would need a new service-level exception type.

## References

- EF Core, connection resiliency: <https://learn.microsoft.com/ef/core/miscellaneous/connection-resiliency>
- SQL Server provider, connection resiliency: <https://learn.microsoft.com/ef/core/providers/sql-server/#connection-resiliency>
- `ExecutionStrategyExtensions.ExecuteAsync`: <https://learn.microsoft.com/dotnet/api/microsoft.entityframeworkcore.executionstrategyextensions.executeasync>
