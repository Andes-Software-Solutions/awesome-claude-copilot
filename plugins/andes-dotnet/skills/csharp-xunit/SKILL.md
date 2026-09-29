---
name: csharp-xunit
description: "Use when writing or reviewing .NET tests: xUnit v3 (latest, Microsoft Testing Platform) + NSubstitute only (no FluentAssertions, Moq, NUnit, or MSTest), naming, theories, fixtures, WebApplicationFactory integration tests, and the Testcontainers → SQLite → test DB → EF InMemory database ladder."
---

# .NET testing: xUnit v3 + NSubstitute

## Policy

- **Framework:** xUnit v3, latest stable (`xunit.v3`), on Microsoft Testing Platform: the test project is an executable (`<OutputType>Exe</OutputType>`) with `<TestingPlatformDotnetTestSupport>true</TestingPlatformDotnetTestSupport>`; scaffold with `dotnet new xunit3`. Add `xunit.runner.visualstudio` and `Microsoft.NET.Test.Sdk` only when VSTest / Test Explorer compatibility is required. Never NUnit or MSTest, and never xUnit v2 (`xunit`) in a new project.
- **Assertions:** xUnit's `Assert` only. Never FluentAssertions, AwesomeAssertions, or Shouldly.
- **Test doubles:** NSubstitute only, plus `NSubstitute.Analyzers.CSharp` to catch substitutions that silently do nothing. Never Moq or FakeItEasy.
- **Existing suites:** if a project already uses a banned library or xUnit v2, new tests still follow this policy and no banned package is added. Migrate existing tests only when asked.

## Project and naming

- Two test projects per solution under `tests/`: `<Root>.Unit.Test` and `<Root>.Integration.Test`, their folders mirroring the source projects (`Api/`, `Service/`, `Repository/`, …), with `TestInfrastructure/` at each root for fixtures, fakes, builders, and collection definitions; test classes mirror the class under test (`OrderServiceTests`). Layout detail in `dotnet-api-architecture`. Existing per-project suites are migrated only when asked.
- Name tests `MethodName_Scenario_ExpectedBehavior`.
- Arrange-Act-Assert structure, with **no** `// Arrange` / `// Act` / `// Assert` comments — blank lines separate the phases.
- One behavior per test; tests are independent and order-agnostic.
- Test code follows `csharp-standards`: fixtures arrive through a primary constructor (`public sealed class OrderServiceTests(DbFixture fixture) : IClassFixture<DbFixture>`), locals use `var`, `TheoryData` rows and expected collections use collection expressions, and private helpers sit in the `Private methods` region.
- Run with `dotnet test` (Microsoft Testing Platform; `dotnet run --project tests/<Root>.Unit.Test -- --filter-method "*Scenario*"` for one test).
- Use the latest stable package versions — check NuGet or the repo's `Directory.Packages.props`, never versions from memory.

## xUnit v3

- `[Fact]` for single cases; `[Theory]` with `[InlineData]`, `[MemberData]`, or `TheoryData<T>` for data-driven cases.
- Setup in the constructor; async setup and teardown via `IAsyncLifetime` (`ValueTask InitializeAsync()` / `DisposeAsync()`).
- Share expensive state with `IClassFixture<T>` (one class) or `ICollectionFixture<T>` (several classes); assembly-wide via `[assembly: AssemblyFixture(typeof(T))]`.
- Pass `TestContext.Current.CancellationToken` to async calls so cancelled runs stop promptly.
- Skip dynamically with `Assert.Skip(reason)`; statically with `Skip = "reason"`.
- `Assert.Equal`, `Assert.Equivalent` (structural), `Assert.Same`, `Assert.True`/`False`, `Assert.Contains`/`DoesNotContain`, `Assert.Single`, `Assert.Empty`, `Assert.Throws<T>` / `await Assert.ThrowsAsync<T>(...)`.
- `ITestOutputHelper` (namespace `Xunit`) for diagnostics.

## NSubstitute

- Substitute interfaces (or abstract/virtual members) at the boundary: `var clock = Substitute.For<IClock>();`.
- Stub with `.Returns(...)`, match with `Arg.Any<T>()` / `Arg.Is<T>(x => ...)`, verify with `.Received(1)` / `.DidNotReceive()`.
- Async: `.Returns(Task.FromResult(x))` or `.Returns(x)`; throw with `.ThrowsAsync(...)` (`NSubstitute.ExceptionExtensions`).
- Do not substitute what you own and can construct cheaply (value objects, pure services); do not substitute `DbContext`/`DbSet` (use the database ladder) or `HttpClient` (use a stub `HttpMessageHandler` or `WebApplicationFactory`).

## Database ladder

Pick the first option the environment supports; record in the test fixture why a lower rung was used.

1. **Testcontainers** — the production engine in Docker (`Testcontainers.MsSql`, `Testcontainers.PostgreSql`, …). One container per collection/assembly fixture implementing `IAsyncLifetime`; apply migrations once with `Database.MigrateAsync()`; isolate tests with a transaction rolled back per test.
2. **SQLite in-memory** — when Docker is unavailable. `Microsoft.EntityFrameworkCore.Sqlite` with `DataSource=:memory:`; keep the `SqliteConnection` open for the context's lifetime and call `EnsureCreated()`. Provider gaps (schemas, some types and SQL translations) mean provider-specific behavior still needs rung 1 or 3.
3. **Dedicated physical test database** — a real, disposable instance; connection string from user secrets or an environment variable, never production and never committed.
4. **EF Core InMemory provider** — last resort. It is not relational (no transactions, constraints, or raw SQL), so use it only for logic that does not depend on database behavior.

## Integration tests (ASP.NET Core)

- `WebApplicationFactory<Program>` (`Microsoft.AspNetCore.Mvc.Testing`; the package name is historical — it hosts Minimal API apps) runs the app in memory; replace external dependencies in `ConfigureTestServices` with NSubstitute substitutes and point data access at the database ladder.
- Assert on status codes and Problem Details bodies (`ValidationProblemDetails.Errors` for FluentValidation failures), not on internal state.
