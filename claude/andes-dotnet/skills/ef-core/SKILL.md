---
name: ef-core
description: "Use when writing or reviewing Entity Framework Core code: DbContext and entity design, queries, change tracking, migrations, performance, security, and database testing (Testcontainers first, EF InMemory last)."
---

# Entity Framework Core Best Practices

Targets EF Core 10. Placement and names per `dotnet-api-architecture`; base entities per `ef-core-base-entities`; lookup tables per `ef-core-enum-reference-tables`.

## Data Context Design

- Services inject the DbContext and query it directly (`dotnet-api-architecture`): the DbContext is the unit of work and each DbSet a repository, so never wrap them in `I<Entity>Repository`, a generic `IRepository<T>`, or a unit-of-work class
- Take options through a primary constructor: `public sealed class ContosoDbContext(DbContextOptions<ContosoDbContext> options) : DbContext(options)`
- Apply one `IEntityTypeConfiguration<T>` per entity from `OnModelCreating` (under `Repository/<Provider>/Configurations/`); shared base mappings are abstract configurations under `Configurations/Base/`
- Scoped lifetime in web apps; `IDbContextFactory<T>` for console apps, background jobs, and tests

## Entity Design

- Derive entities from the `Entity/Base/` classes per `ef-core-base-entities`. Keys are `Guid` (default) or `int`; enforce a natural key with a unique index, never by making it the primary key
- Put every length, precision, and scale limit of an entity in `Common/Constants/<Feature>/<Entity>Limits.cs`: the configuration's `HasMaxLength` / `HasPrecision` and the request validator's `MaximumLength` / `PrecisionScale` read the same constant, so the column and the 400 never disagree
- Model a fixed set of values (status, type, category) as an enum-backed reference table per `ef-core-enum-reference-tables`
- Configure keys, constraints, relationships, and mappings with the fluent API in `IEntityTypeConfiguration<T>` classes only; never put DataAnnotations mapping attributes on entities, and never validate with them (validation is FluentValidation on request types)
- Model value objects (an address, a money amount) as complex types — `ComplexProperty`, or `ComplexProperty(..., c => c.ToJson())` / `ComplexCollection(..., c => c.ToJson())` for a JSON column — never owned entity types in new code: complex types have value semantics and support `ExecuteUpdateAsync` ([complex vs owned types](https://learn.microsoft.com/ef/core/modeling/complex-types#complex-types-vs-owned-entity-types))

## Performance

- Use `AsNoTracking()` for read-only queries, and project (`Select`, through the feature mapper's expression) to fetch only the columns needed
- Page every list. `Skip` / `Take` for shallow pages; keyset pagination (`Where(o => o.Id > lastId).OrderBy(o => o.Id).Take(n)`) for deep or infinite-scroll pages, since `Skip` still scans the skipped rows ([pagination](https://learn.microsoft.com/ef/core/querying/pagination))
- Avoid N+1: `Include` what the projection cannot express, `AsSplitQuery()` when several collection includes would multiply rows
- Use compiled queries only for measured hot paths

## Migrations

- Create small, focused migrations named `<Verb><Subject>`; review the generated SQL (`dotnet ef migrations script --idempotent`) before applying it to production
- Deploy with migration bundles or idempotent scripts; when the app applies migrations itself, it does so only through the provider's `<Provider>SchemaMigrator` (`dotnet-api-architecture`)
- Seed and script rules (`HasData`, `InsertData`, `Scripts/`, `UseSeeding`): `dotnet-api-architecture` `references/persistence.md`

## Querying

- Prefer strongly typed LINQ over raw SQL; know where a query executes (`IQueryable` composes on the server until enumerated)
- Reuse a query two services share as an extension method on `IQueryable<T>` beside the first service that needs it, not as a repository

## Change Tracking & Saving

- Start tracking new entities with `_ctx.Add` / `_ctx.AddRange`, never `AddAsync` / `AddRangeAsync`. Adding only marks entities `Added` and does not touch the database; the async overloads exist solely for the HiLo value generator, which these standards never configure (Guid keys are generated client-side and int keys by an identity column, `ef-core-base-entities`). The round trip is `SaveChangesAsync`, which stays async. [Add versus AddAsync](https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#add-versus-addasync)
- Write through the DbContext, never the DbSet: `_ctx.Add(product)`, `_ctx.Update(product)`, `_ctx.Remove(product)` (and `AddRange` / `UpdateRange` / `RemoveRange` / `Attach`), not `_ctx.Products.Add(product)`. EF Core resolves the entity type from the instance; DbSets are for queries (`_ctx.Products.Where(...)`). The one exception is a shared-type entity (such as a `Dictionary<string, object>` join), which writes through `_ctx.Set<T>("Name")`. Change a tracked entity in place and save; call `Update` only for a detached one, since it marks every property modified. [DbContext versus DbSet methods](https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#dbcontext-versus-dbset-methods)
- One `SaveChangesAsync` per unit of work: it batches the statements and is already atomic. Open an explicit transaction only for a unit that spans several saves, or a save plus `ExecuteUpdateAsync` / `ExecuteDeleteAsync` / raw SQL, and run it inside the execution strategy (Connection resiliency, below)
- Optimistic concurrency uses the row version and `ConflictException` (`ef-core-base-entities`)

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

- If the connection drops during commit, the strategy replays the unit as if it rolled back. Client-generated Guid keys (`ef-core-base-entities`) turn a replay of a commit that did succeed into a duplicate-key failure instead of a duplicate row. An int identity key gives no such protection: the replay inserts a second row unless the table has a unique natural key.
- Retry buffers each result set in memory, so page large reads instead of streaming one unbounded `AsAsyncEnumerable`.

## Security

- Raw SQL only through `FromSql` / `ExecuteSql` with interpolated parameters; never `FromSqlRaw` / `ExecuteSqlRaw` with concatenated input
- The app's database login holds only the permissions it needs; schema changes run under a separate migration identity
- Encrypt sensitive columns, and keep `EnableSensitiveDataLogging` off outside local development so parameter values never reach the logs

## Testing

- Follow the database ladder in the `csharp-xunit` skill: Testcontainers → SQLite in-memory → dedicated test database → EF Core InMemory provider (last resort; not relational).
- Never mock `DbContext` or `DbSet` — test queries against a real provider.
- Apply migrations (`Database.MigrateAsync()`) on Testcontainers and the dedicated test database so tests exercise the production schema; on SQLite use `EnsureCreatedAsync()`, because `Scripts/*.sql` and provider-specific migrations do not run there.
- Test migrations against the production engine before release.
