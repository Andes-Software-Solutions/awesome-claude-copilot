# Testing base entities

- **Clock.** Inject `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) into the interceptors, `Advance(...)` between saves, and assert `DateCreated` / `DateModified` exactly. xUnit v3 + NSubstitute per `csharp-xunit`; the fake is the double, no substitute for `TimeProvider` is needed.
- **Rung by behaviour** (the `csharp-xunit` database ladder):
  - Concurrency, purge (`ExecuteDelete`), and anything that filters or sorts by a stamp (`DateDeactivated < cutoff`) run on Testcontainers or the dedicated test database.
  - SQLite in-memory covers stamps and the deactivation filter (`== null` is an equality test), but it cannot compare or order `DateTimeOffset` in SQL and does not support database-generated concurrency tokens ([SQLite limitations](https://learn.microsoft.com/ef/core/providers/sqlite/limitations)). A SQLite fixture for a `BaseModifiedEntity<TKey>` table therefore remaps `Version` so inserts succeed — for example `HasDefaultValueSql("randomblob(8)")` in the fixture's model customization — or those tests move to rung 1 or 3.
  - The EF Core InMemory provider is a last resort and generates no row version.
- **Where tests live.** Interceptor tests under `test/<Root>.Unit.Test/Repository/<Provider>/Interceptors/`; service behaviour (translation to `ConflictException`, purge, reactivation) under `test/<Root>.Unit.Test/Service/<Feature>/`.
