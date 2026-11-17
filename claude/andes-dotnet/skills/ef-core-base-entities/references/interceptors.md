# The interceptors

Both live in `Repository/<Provider>/Interceptors/`, one per file, `internal sealed`. Both overrides call one private method so `SaveChanges` and `SaveChangesAsync` behave the same; production code stays async end to end (`csharp-async`).

## `AuditTimestampInterceptor`

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
        foreach (var entry in ctx.ChangeTracker.Entries<IBaseCreatedEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.DateCreated = now;
                    break;
                case EntityState.Modified:
                    entry.Property(nameof(IBaseCreatedEntity.DateCreated)).IsModified = false;   // a detached Update would otherwise write the client's default
                    if (entry.Entity is IBaseModifiedEntity modified)
                    {
                        modified.DateModified = now;
                    }
                    break;
            }
        }
    }

    #endregion
}
```

## `DeactivationInterceptor`

Same two overrides; the private method turns a delete into an update of the stamp alone:

```csharp
private void Deactivate(DbContext ctx)
{
    var now = _time.GetUtcNow();
    foreach (var entry in ctx.ChangeTracker.Entries<IBaseEntity>().Where(e => e.State == EntityState.Deleted))
    {
        entry.State = EntityState.Unchanged;                 // not Modified: that would mark every property and overwrite the row
        entry.Entity.DateDeactivated = now;
        entry.Property(nameof(IBaseEntity.DateDeactivated)).IsModified = true;
    }
}
```

The `UPDATE` then sets `DateDeactivated` (and `DateModified`, from `AuditTimestampInterceptor`) and still checks the row version, so a stub or detached `Remove` never writes default values over the row.

## Registration — `<Provider>PersistenceConfiguration.cs`

```csharp
services.TryAddSingleton(TimeProvider.System);
services.AddSingleton<DeactivationInterceptor>();
services.AddSingleton<AuditTimestampInterceptor>();
services.AddDbContext<ContosoDbContext>((sp, options) => options
    .UseSqlServer(
        sp.GetRequiredService<IOptions<SqlDbOptions>>().Value.ConnectionString,
        sql => sql.EnableRetryOnFailure())   // ef-core: Connection resiliency
    .AddInterceptors(sp.GetRequiredService<DeactivationInterceptor>(), sp.GetRequiredService<AuditTimestampInterceptor>()));
```

Interceptors are stateless singletons resolved from the container, so `TimeProvider` is injected and a test replaces it. They run in registration order: `DeactivationInterceptor` first, so the entry it turns into an update receives its `DateModified`.

## Bulk operations bypass the interceptors

`ExecuteDeleteAsync` / `ExecuteUpdateAsync` skip the change tracker, so no interceptor sees them.

- **Hard delete** is one explicit service method named for it: `PurgeAsync` → `_ctx.Orders.IgnoreQueryFilters(["Deactivation"]).Where(o => o.DateDeactivated < cutoff).ExecuteDeleteAsync(ct)`.
- **Reactivation** is `ReactivateAsync`: read with `IgnoreQueryFilters(["Deactivation"])`, set `DateDeactivated = null`, save — the one place a service writes a stamp.
- **A bulk update** of a `BaseModifiedEntity<TKey>` table sets `DateModified` itself: `.ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, status).SetProperty(o => o.DateModified, _time.GetUtcNow()), ct)`.
