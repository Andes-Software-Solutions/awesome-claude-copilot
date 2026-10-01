---
name: ef-core
description: "Use when writing or reviewing Entity Framework Core code: DbContext and entity design, queries, change tracking, migrations, performance, security, and database testing (Testcontainers first, EF InMemory last)."
---

# Entity Framework Core Best Practices

## Data Context Design

- Keep DbContext classes focused and cohesive
- Services inject the DbContext and query it directly (`dotnet-api-architecture`): the DbContext is the unit of work and each DbSet a repository, so never wrap them in `I<Entity>Repository`, a generic `IRepository<T>`, or a unit-of-work class
- Take options through a primary constructor: `public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)`
- Override OnModelCreating for fluent API configuration
- Separate entity configurations using IEntityTypeConfiguration (one per entity under `Repository/<Provider>/Configurations/`, per `dotnet-api-architecture`); shared base mappings are abstract configurations under `Configurations/Base/`
- Consider using DbContextFactory pattern for console apps or tests

## Entity Design

- Derive entities from the `Entity/Base/` classes (`BaseEntity`, `BaseCreatedEntity`, `BaseModifiedEntity`) per `ef-core-base-entities`: Guid keys, soft delete, UTC audit stamps, and a row-version token, all mapped fluently and stamped by interceptors
- Model a fixed set of values (status, type, category) as an enum-backed reference table per `ef-core-enum-reference-tables`
- Use meaningful primary keys (consider natural vs surrogate keys)
- Implement proper relationships (one-to-one, one-to-many, many-to-many)
- Configure keys, constraints, and mappings with the fluent API in `IEntityTypeConfiguration<T>` classes only; never put DataAnnotations mapping attributes on entities, and never validate with them (validation is FluentValidation on request types)
- Implement appropriate navigational properties
- Consider using owned entity types for value objects

## Performance

- Use AsNoTracking() for read-only queries
- Implement pagination for large result sets with Skip() and Take()
- Use Include() to eager load related entities when needed
- Consider projection (Select) to retrieve only required fields
- Use compiled queries for frequently executed queries
- Avoid N+1 query problems by properly including related data

## Migrations

- Create small, focused migrations
- Name migrations descriptively
- Verify migration SQL scripts before applying to production
- Consider using migration bundles for deployment
- Add data seeding through migrations when appropriate

## Querying

- Use IQueryable judiciously and understand when queries execute
- Prefer strongly-typed LINQ queries over raw SQL
- Use appropriate query operators (Where, OrderBy, GroupBy)
- Consider database functions for complex operations
- Reuse a query two services share as an extension method on `IQueryable<T>` beside the first service that needs it, not as a repository

## Change Tracking & Saving

- Start tracking new entities with `_ctx.Add` / `_ctx.AddRange`, never `AddAsync` / `AddRangeAsync`. Adding only marks entities `Added` and does not touch the database; the async overloads exist solely for the HiLo value generator, which these standards never configure (Guid keys are generated client-side, `ef-core-base-entities`). The round trip is `SaveChangesAsync`, which stays async. [Add versus AddAsync](https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#add-versus-addasync)
- Write through the DbContext, never the DbSet: `_ctx.Add(product)`, `_ctx.Update(product)`, `_ctx.Remove(product)` (and `AddRange` / `UpdateRange` / `RemoveRange` / `Attach`), not `_ctx.Products.Add(product)`. EF Core resolves the entity type from the instance; DbSets are for queries (`_ctx.Products.Where(...)`). The one exception is a shared-type entity (such as a `Dictionary<string, object>` join), which writes through `_ctx.Set<T>("Name")`. Change a tracked entity in place and save; call `Update` only for a detached one, since it marks every property modified. [DbContext versus DbSet methods](https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#dbcontext-versus-dbset-methods)
- Use appropriate change tracking strategies
- Batch your SaveChanges() calls
- Implement concurrency control for multi-user scenarios
- One `SaveChangesAsync` is already atomic; open an explicit transaction only for a unit that spans several saves, or a save plus `ExecuteUpdateAsync` / `ExecuteDeleteAsync` / raw SQL, and run it inside the execution strategy (Connection resiliency, below)
- Use appropriate DbContext lifetimes (scoped for web apps)

## Connection resiliency

- Every relational registration retries transient failures: `UseSqlServer(cs, sql => sql.EnableRetryOnFailure())`, `UseNpgsql(cs, npgsql => npgsql.EnableRetryOnFailure())`. `UseAzureSql` / `UseAzureSynapse` already retry, and SQLite has no retrying strategy. Keep the provider defaults (6 retries, 30-second maximum delay); tune them only for a measured reason. [Connection resiliency](https://learn.microsoft.com/ef/core/miscellaneous/connection-resiliency)
- With retry on, each query and each `SaveChangesAsync` is retried on its own, and `BeginTransactionAsync` or a `TransactionScope` outside the strategy throws. Run the whole unit through the strategy, with every read and write inside the delegate, because a retry runs the delegate again:

```csharp
var strategy = _ctx.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async ct =>
{
    _ctx.ChangeTracker.Clear();   // a retry replays the unit from a clean tracker
    await using var transaction = await _ctx.Database.BeginTransactionAsync(ct);
    // ...every read and write of the unit...
    await transaction.CommitAsync(ct);
}, cancellationToken);
```

- If the connection drops during commit, the strategy replays the unit as if it rolled back. Client-generated Guid keys (`ef-core-base-entities`) turn a replay of a commit that did succeed into a duplicate-key failure instead of a duplicate row.
- Retry buffers each result set in memory, so page large reads (`Skip` / `Take`) instead of streaming one unbounded `AsAsyncEnumerable`.

## Security

- Avoid SQL injection by using parameterized queries
- Implement appropriate data access permissions
- Be careful with raw SQL queries
- Consider data encryption for sensitive information
- Use migrations to manage database user permissions

## Testing

- Follow the database ladder in the `csharp-xunit` skill: Testcontainers → SQLite in-memory → dedicated test database → EF Core InMemory provider (last resort; not relational).
- Never mock `DbContext` or `DbSet` — test queries against a real provider.
- Apply migrations in the test fixture (`Database.MigrateAsync()`) so tests exercise the schema production uses.
- Test migrations against the production engine before release.

When reviewing EF Core code, identify issues and suggest improvements that follow these practices.
