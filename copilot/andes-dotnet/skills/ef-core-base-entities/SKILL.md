---
name: ef-core-base-entities
description: "Use when adding or reviewing entities with a Guid or int key, deactivation, audit timestamps, or optimistic concurrency: the BaseEntity<TKey> / BaseCreatedEntity<TKey> / BaseModifiedEntity<TKey> classes and their configurations, the named Deactivation filter, the TimeProvider interceptors, and row-version conflicts as ConflictException."
---

# EF Core base entities

Three abstract classes, generic over the key type, give every table the same key shape, deactivation, audit stamps, and concurrency token; three abstract configurations map them once; two interceptors keep the stamps honest. Entities stay plain: no EF Core package, no mapping attributes — never `[Timestamp]`, `[Key]`, `[ConcurrencyCheck]`, or any DataAnnotations. Placement per `dotnet-api-architecture`; practice per `ef-core`; lookup tables per `ef-core-enum-reference-tables`.

## The classes — `Entity/Base/`, one per file

```csharp
// Entity/Base/BaseEntity.cs
public interface IBaseEntity
{
    DateTimeOffset? DateDeactivated { get; set; }
}

public abstract class BaseEntity<TKey> : IBaseEntity
    where TKey : struct, IEquatable<TKey>
{
    public TKey Id { get; set; }
    public DateTimeOffset? DateDeactivated { get; set; }  // offset zero; null = active. The timestamp is the deactivation flag — no IsActive bool.
}

// Entity/Base/BaseCreatedEntity.cs
public interface IBaseCreatedEntity
{
    DateTimeOffset DateCreated { get; set; }
}

public abstract class BaseCreatedEntity<TKey> : BaseEntity<TKey>, IBaseCreatedEntity
    where TKey : struct, IEquatable<TKey>
{
    public DateTimeOffset DateCreated { get; set; }   // offset zero, set once by AuditTimestampInterceptor
}

// Entity/Base/BaseModifiedEntity.cs
public interface IBaseModifiedEntity
{
    DateTimeOffset? DateModified { get; set; }
}

public abstract class BaseModifiedEntity<TKey> : BaseCreatedEntity<TKey>, IBaseModifiedEntity
    where TKey : struct, IEquatable<TKey>
{
    public DateTimeOffset? DateModified { get; set; } // offset zero, set on every update by AuditTimestampInterceptor
    public byte[] Version { get; set; } = [];         // concurrency token; rowversion on SQL Server
}

// Entity/Orders/Order.cs — every entity names its key
public sealed class Order : BaseModifiedEntity<Guid>
{
    public required string Number { get; set; }
}
```

- Derive from the shallowest class that fits: an append-only ledger row is `BaseCreatedEntity<TKey>`; anything a user edits is `BaseModifiedEntity<TKey>`.
- Each interface is the non-generic face of the class in its file, so the interceptors can enumerate every key type at once (`Entries<IBaseCreatedEntity>()`). Nothing else implements them, and entities never name them.
- Every timestamp is a `DateTimeOffset` at offset zero from `TimeProvider.GetUtcNow()` — never `DateTime` (its `Kind` does not survive the round trip) and never `DateTime.UtcNow` / `DateTimeOffset.UtcNow`. The column is `datetimeoffset` on SQL Server and `timestamp with time zone` on PostgreSQL, where Npgsql rejects any non-zero offset.
- The interceptors write the stamps; a service never sets them, with two exceptions: `ReactivateAsync` clears `DateDeactivated`, and an `ExecuteUpdateAsync` on a `BaseModifiedEntity<TKey>` table sets `DateModified` from `TimeProvider` in the same call, because bulk updates bypass the interceptors.
- Enum reference tables do not derive from these; they use `BaseEnumEntity<TEnum>`.

## Choosing the key

`TKey` is `Guid` (the default: client-generated, known before `SaveChangesAsync`, safe to expose) or `int` (a single-database table whose key size matters, with a unique natural key), nothing else. Trade-offs, generation strategies, and the int caveats: [`references/keys.md`](references/keys.md).

## The configurations — `Repository/<Provider>/Configurations/Base/`, one per file

```csharp
public abstract class BaseEntityConfiguration<T, TKey> : IEntityTypeConfiguration<T>
    where T : BaseEntity<TKey>
    where TKey : struct, IEquatable<TKey>
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
        builder.HasQueryFilter("Deactivation", e => e.DateDeactivated == null);
        builder.HasIndex(e => e.DateDeactivated);
    }

    protected abstract void ConfigureEntity(EntityTypeBuilder<T> builder);
}

public abstract class BaseCreatedEntityConfiguration<T, TKey> : BaseEntityConfiguration<T, TKey>
    where T : BaseCreatedEntity<TKey>
    where TKey : struct, IEquatable<TKey>
{
    protected override void ConfigureBase(EntityTypeBuilder<T> builder)
    {
        base.ConfigureBase(builder);
        builder.Property(e => e.DateCreated).IsRequired();
    }
}

public abstract class BaseModifiedEntityConfiguration<T, TKey> : BaseCreatedEntityConfiguration<T, TKey>
    where T : BaseModifiedEntity<TKey>
    where TKey : struct, IEquatable<TKey>
{
    protected override void ConfigureBase(EntityTypeBuilder<T> builder)
    {
        base.ConfigureBase(builder);
        builder.Property(e => e.Version).IsRowVersion();
    }
}

// Common/Constants/Orders/OrderLimits.cs — shared with CreateOrderActionDtoValidator (dotnet-api-architecture)
public static class OrderLimits
{
    public const int NumberMaxLength = 32;
}

// Repository/Sql/Configurations/Orders/OrderConfiguration.cs — still one configuration per entity
public sealed class OrderConfiguration : BaseModifiedEntityConfiguration<Order, Guid>
{
    protected override void ConfigureEntity(EntityTypeBuilder<Order> builder)
    {
        builder.Property(o => o.Number).HasMaxLength(OrderLimits.NumberMaxLength).IsRequired();
        builder.HasIndex(o => o.Number).IsUnique().HasFilter("[DateDeactivated] IS NULL");
    }
}
```

- **Fluent, never attributes.** The token is provider-specific (`rowversion` on SQL Server, `xmin` on PostgreSQL), which is exactly why the mapping lives in the provider's `Configurations/Base/`.
- **Limits come from `<Entity>Limits`**, never a literal: the request validator enforces the same number.
- **Unique indexes on deactivatable tables are filtered to active rows** (`HasFilter("[DateDeactivated] IS NULL")` on SQL Server, `"\"DateDeactivated\" IS NULL"` on PostgreSQL), so a deactivated row does not block reuse of its value — unless reuse is forbidden by design, which the configuration states in a comment.
- **The filter is named** (`"Deactivation"`) so `IgnoreQueryFilters(["Deactivation"])` lifts only it once a tenant filter joins it; never an unnamed filter on a `BaseEntity<TKey>`. A required navigation to a deactivated principal inner-joins the dependent away — make it optional or filter the dependent too (EF warns with `PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning`).

## The interceptors — `Repository/<Provider>/Interceptors/`, one per file

- `DeactivationInterceptor` turns every `Deleted` `IBaseEntity` entry (a service's `_ctx.Remove`) into an update of `DateDeactivated` alone; `AuditTimestampInterceptor` stamps `DateCreated` on insert and `DateModified` on update, and never lets an update overwrite `DateCreated`.
- Both are stateless `internal` singletons on an injected `TimeProvider` (`TryAddSingleton(TimeProvider.System)`), attached in `<Provider>PersistenceConfiguration.cs` in that order, so the deactivated entry receives its `DateModified`. One interceptor per concern — no `SaveChanges` override on the DbContext.
- `ExecuteDeleteAsync` / `ExecuteUpdateAsync` bypass them. A hard delete is one explicit service method named for it (`PurgeAsync`); `IgnoreQueryFilters` appears only in methods whose name says so (`PurgeAsync`, `ReactivateAsync`, `GetDeactivatedAsync`).

Code, registration, and the purge and reactivate shapes: [`references/interceptors.md`](references/interceptors.md).

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
- The row version is the token, never `DateModified`. A conflict becomes `ConflictException` (409 per `aspnet-rest-apis`) and is never resolved by re-reading and overwriting silently.

## Testing

Inject `FakeTimeProvider` and assert stamps exactly; run concurrency and purge tests on the real engine. SQLite cannot generate a row version or compare `DateTimeOffset`, so read [`references/testing.md`](references/testing.md) before picking a rung of the `csharp-xunit` ladder.
