---
name: ef-core-base-entities
description: "Use when adding or reviewing entities that need a Guid key, soft delete, audit timestamps, or optimistic concurrency: BaseEntity / BaseCreatedEntity / BaseModifiedEntity in Entity/Base/, their abstract EF configurations in Configurations/Base/, the named SoftDelete query filter, the SoftDelete and AuditTimestamp interceptors on TimeProvider, and row-version conflicts as ConflictException."
---

# EF Core base entities

Three abstract classes give every table the same key, soft delete, audit stamps, and concurrency token; three abstract configurations map them once; two interceptors keep the stamps honest. Entities stay plain: no EF Core package, no mapping attributes — never `[Timestamp]`, `[Key]`, or any DataAnnotations. Placement per `dotnet-api-architecture`; practice per `ef-core`; lookup tables per `ef-core-enum-reference-tables`.

## The classes — `Entity/Base/`, one per file

```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; }
    public DateTimeOffset? DateDeleted { get; set; }  // offset zero; null = live. The timestamp is the soft-delete flag.
}

public abstract class BaseCreatedEntity : BaseEntity
{
    public DateTimeOffset DateCreated { get; set; }   // offset zero, set once by AuditTimestampInterceptor
}

public abstract class BaseModifiedEntity : BaseCreatedEntity
{
    public DateTimeOffset? DateModified { get; set; } // offset zero, set on every update by AuditTimestampInterceptor
    public byte[] Version { get; set; } = [];         // concurrency token; rowversion on SQL Server
}
```

- Derive from the shallowest class that fits: an append-only ledger row is `BaseCreatedEntity`; anything a user edits is `BaseModifiedEntity`.
- Every timestamp is a `DateTimeOffset` at offset zero (`TimeProvider.GetUtcNow()`) and is written only by the interceptors — a service never sets them. Never `DateTime`: its `Kind` does not survive the round trip, so a read-back value is ambiguous. The column is `datetimeoffset` on SQL Server and `timestamp with time zone` on PostgreSQL, where Npgsql rejects any non-zero offset.
- Enum reference tables do not derive from these; they use `BaseEnumEntity<TEnum>`.

## The configurations — `Repository/<Provider>/Configurations/Base/`, one per file

```csharp
public abstract class BaseEntityConfiguration<T> : IEntityTypeConfiguration<T>
    where T : BaseEntity
{
    public void Configure(EntityTypeBuilder<T> builder)
    {
        ConfigureBase(builder);
        ConfigureEntity(builder);
    }

    protected virtual void ConfigureBase(EntityTypeBuilder<T> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedOnAdd();
        builder.HasQueryFilter("SoftDelete", e => e.DateDeleted == null);
        builder.HasIndex(e => e.DateDeleted);
    }

    protected abstract void ConfigureEntity(EntityTypeBuilder<T> builder);
}

public abstract class BaseCreatedEntityConfiguration<T> : BaseEntityConfiguration<T>
    where T : BaseCreatedEntity
{
    protected override void ConfigureBase(EntityTypeBuilder<T> builder)
    {
        base.ConfigureBase(builder);
        builder.Property(e => e.DateCreated).IsRequired();
    }
}

public abstract class BaseModifiedEntityConfiguration<T> : BaseCreatedEntityConfiguration<T>
    where T : BaseModifiedEntity
{
    protected override void ConfigureBase(EntityTypeBuilder<T> builder)
    {
        base.ConfigureBase(builder);
        builder.Property(e => e.Version).IsRowVersion();
    }
}

// Repository/Sql/Configurations/Orders/OrderConfiguration.cs — still one configuration per entity
public sealed class OrderConfiguration : BaseModifiedEntityConfiguration<Order>
{
    protected override void ConfigureEntity(EntityTypeBuilder<Order> builder)
    {
        builder.Property(o => o.Number).HasMaxLength(32).IsRequired();
        builder.HasIndex(o => o.Number).IsUnique();
    }
}
```

- **Fluent, never attributes.** `[Timestamp]` is a DataAnnotations attribute and entities carry no attributes; the token is also provider-specific (`rowversion` on SQL Server, `xmin` on PostgreSQL), which is exactly why the mapping lives in the provider's `Configurations/Base/`.
- **Guid generation.** `ValueGeneratedOnAdd()` uses the provider's client-side generator (sequential Guids on SQL Server, UUIDv7 on Npgsql), so `Id` is known before `SaveChangesAsync` and a parent and its children insert in one round trip. Use `HasValueGenerator<…>` with `Guid.CreateVersion7()` only when ids must sort by time across stores — on SQL Server a v7 Guid is not sequential in index order, so the clustered key fragments. A caller may still set `Id`; EF generates only when it is `default`.
- **The filter is named** (`"SoftDelete"`, EF Core 10) so `IgnoreQueryFilters(["SoftDelete"])` lifts only it once a tenant filter joins it; on EF Core 9 use the unnamed overload. A required navigation to a soft-deleted principal inner-joins the dependent away — make it optional or filter the dependent too (EF warns with `PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning`).

## The interceptors — `Repository/<Provider>/Interceptors/`, one per file

```csharp
internal sealed class AuditTimestampInterceptor(TimeProvider time) : SaveChangesInterceptor
{
    private readonly TimeProvider _time = time;

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Stamp(eventData.Context!);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Stamp(eventData.Context!);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    #region Private methods

    private void Stamp(DbContext ctx)
    {
        var now = _time.GetUtcNow();
        foreach (var entry in ctx.ChangeTracker.Entries<BaseCreatedEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.DateCreated = now;
                    break;
                case EntityState.Modified when entry.Entity is BaseModifiedEntity modified:
                    modified.DateModified = now;
                    break;
            }
        }
    }

    #endregion
}
```

`SoftDeleteInterceptor` has the same two overrides; its body flips every `Deleted` entry of a `BaseEntity` to `Modified` and sets `DateDeleted = now`. Registration in `<Provider>PersistenceConfiguration.cs`:

```csharp
services.TryAddSingleton(TimeProvider.System);
services.AddSingleton<SoftDeleteInterceptor>();
services.AddSingleton<AuditTimestampInterceptor>();
services.AddDbContext<ContosoDbContext>((sp, options) => options
    .UseSqlServer(sp.GetRequiredService<IOptions<SqlDbOptions>>().Value.ConnectionString)
    .AddInterceptors(sp.GetRequiredService<SoftDeleteInterceptor>(), sp.GetRequiredService<AuditTimestampInterceptor>()));
```

- Interceptors are stateless singletons resolved from the container, so `TimeProvider` is injected and a test replaces it. They run in registration order: `SoftDeleteInterceptor` first, so the entry it flips to `Modified` receives its `DateModified`.
- Both overrides call one private method so `SaveChanges` and `SaveChangesAsync` behave the same; production code stays async end to end (`csharp-async`).
- `ExecuteDeleteAsync` / `ExecuteUpdateAsync` bypass the change tracker, so no interceptor sees them. A hard delete is therefore one explicit service method named for it — `PurgeAsync`: `_ctx.Orders.IgnoreQueryFilters(["SoftDelete"]).Where(o => o.DateDeleted < cutoff).ExecuteDeleteAsync(ct)`. Restore is `RestoreAsync`: read with `IgnoreQueryFilters`, set `DateDeleted = null`, save.

## Concurrency

```csharp
// Service/Orders/OrderService.cs (excerpt)
_ctx.Entry(order).Property(o => o.Version).OriginalValue = expectedVersion;   // what the client last saw
try
{
    await _ctx.SaveChangesAsync(cancellationToken);
}
catch (DbUpdateConcurrencyException)
{
    throw new ConflictException($"Order {order.Id} was modified by another request.");
}
```

- The response DTO carries `Version` (base64 string); the update action DTO sends it back; the service sets it as the `OriginalValue` before saving so the `UPDATE … WHERE` compares against the client's copy.
- `ConflictException` lives in `Service/Exceptions/` beside `NotFoundException` and `ForbiddenException`; `Api/ExceptionHandlers/GlobalExceptionHandler.cs` maps it to a 409 Problem Details. `DbUpdateConcurrencyException` never reaches Api, and a conflict is never resolved by re-reading and overwriting silently.

## Testing

- Inject `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) into the interceptors, `Advance(...)` between saves, and assert `DateCreated` / `DateModified` exactly. xUnit v3 + NSubstitute per `csharp-xunit`; the fake is the double, no substitute for `TimeProvider` is needed.
- Database through the `csharp-xunit` ladder: `rowversion` and `ExecuteDelete` exist only on the real engine, so concurrency and purge tests run on Testcontainers or the dedicated test database; SQLite in-memory covers stamps and the soft-delete filter (`== null` is an equality test), but it cannot compare or order `DateTimeOffset` in SQL, so anything that filters or sorts by a stamp (`DateDeleted < cutoff`) needs rung 1 or 3; the EF Core InMemory provider is a last resort and generates no row version.
- Interceptor tests live under `test/<Root>.Unit.Test/Repository/<Provider>/Interceptors/`; service behaviour (translation to `ConflictException`, purge, restore) under `test/<Root>.Unit.Test/Service/<Feature>/`.

## Never

- No `[Timestamp]`, `[Key]`, `[ConcurrencyCheck]`, or any DataAnnotations on an entity — fluent only, in `Configurations/Base/`.
- No `DateTime` stamp on a base entity — `DateTimeOffset` at offset zero only.
- No `DateTime.UtcNow` or `DateTimeOffset.UtcNow` in interceptors or services — `TimeProvider` only, so tests control the clock.
- No `IsDeleted` bool beside `DateDeleted`; the timestamp is the flag.
- No `IgnoreQueryFilters` outside a service method whose name says so (`PurgeAsync`, `RestoreAsync`, `GetDeletedAsync`).
- No `SaveChanges` override on the DbContext for stamps or soft delete — one interceptor per concern.
- No `DateModified` as a concurrency token; the row version is.
- No unnamed query filter on a `BaseEntity`: a second filter could then not be lifted without the first.
