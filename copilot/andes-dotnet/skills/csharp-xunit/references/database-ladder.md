# Database ladder: fixture setup

How each rung of the `csharp-xunit` database ladder is wired. Services query the `DbContext` directly, so every service test runs against one of these.

## 1. Testcontainers

- One container per collection or assembly fixture implementing `IAsyncLifetime`.
- Apply migrations once with `Database.MigrateAsync()`.
- Isolate tests with a transaction rolled back per test.
- The fixture builds its own `DbContextOptions` with the production provider call minus `EnableRetryOnFailure()`: a retrying execution strategy rejects a user-initiated transaction (`ef-core`).
- Two cases can't use the per-test transaction, so they delete the rows they create or use a fresh database per test class:
  - `WebApplicationFactory` tests, which keep the production registration and its retry.
  - Tests of a service that opens its own transaction, which can't nest inside the test's.

## 2. SQLite in-memory

- `Microsoft.EntityFrameworkCore.Sqlite` with `DataSource=:memory:`.
- Keep the `SqliteConnection` open for the context's lifetime; the database disappears when it closes.
- Create the schema with `EnsureCreated()`, not migrations: migration scripts carry provider-specific SQL.
- Provider gaps (schemas, some types and SQL translations, database-generated concurrency tokens) mean provider-specific behavior still needs rung 1 or 3. Tables built on the base entities need the SQLite setup that `ef-core-base-entities` describes.

## 3. Dedicated physical test database

- A real, disposable instance; the connection string comes from user secrets or an environment variable, never production and never committed.
- Same isolation as rung 1: a transaction per test, or rows cleaned up per test class.

## 4. EF Core InMemory

- Last resort. It is not relational — no transactions, constraints, or raw SQL — so use it only for logic that does not depend on database behavior.
