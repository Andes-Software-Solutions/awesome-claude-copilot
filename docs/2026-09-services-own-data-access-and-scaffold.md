# Services own data access, one exception handler, and `andes-scaffold`

**Date:** 2026-09-29. **Status:** accepted. This record supersedes the repository placement in [2026-09-persistence-layout-and-ef-core-entity-skills.md](2026-09-persistence-layout-and-ef-core-entity-skills.md), where repositories lived in `Service/<Feature>/`. The `<Root>.Repository` project and its provider-first plumbing are unchanged.

## Decisions

### D1. No repository layer

`<Entity>Service` takes the `DbContext` through its primary constructor (`ctx` / `_ctx`) and queries it directly. The standards drop `I<Entity>Repository` / `<Entity>Repository`, generic `IRepository<T>`, and unit-of-work classes.

- **Why.** The `DbContext` is already the unit of work, and each `DbSet` is already a repository. A repository beside each service doubled the files per feature, and most of its methods only forwarded calls. The interface existed so service tests could substitute it. Service tests now run on the `csharp-xunit` database ladder, which the standards already required for the repository's own tests.
- **What stays.** `<Root>.Repository` keeps the DbContext, configurations, migrations, interceptors, provisioning, and health probes. That boundary keeps provider types out of Service, and it is independent of the repository pattern. A non-EF store is still reached through its `I<Subject>Store` gateway.
- **Moved into the service.** Store-fault translation (`DbUpdateConcurrencyException` → `ConflictException`, and so on), `AsNoTracking()` reads through the mapper expression, and the named `PurgeAsync` / `RestoreAsync` methods. A query two services share becomes an `IQueryable<T>` extension method beside the first service that needs it.
- **Second store.** The service injects the second `DbContext` or gateway. Before this change, the story was a second repository implementation plus an `Interfaces/` move.

### D2. `Add` / `AddRange`, never `AddAsync`

EF Core documents that `AddAsync` exists "only to allow special value generators, such as … SequenceHiLo, to access the database asynchronously". These standards never configure HiLo: Guid keys are generated on the client. `Add` therefore does all the work of `AddAsync` without allocating a `ValueTask`, and it keeps the only real round trip, `SaveChangesAsync`, as the obvious await.

**Amended 2026-10-01: writes go on the `DbContext`.** `Add`, `Update`, `Attach`, and `Remove` behave exactly the same on the `DbContext` and on a `DbSet`, because each CLR type maps to one entity type. Services therefore call `_ctx.Add(product)`, not `_ctx.Products.Add(product)`, and DbSets appear only in queries. The exception is a shared-type entity, such as a `Dictionary<string, object>` many-to-many join, whose CLR type maps to more than one entity type. It writes through `_ctx.Set<T>("Name")`.

### D3. One `GlobalExceptionHandler`

A single `IExceptionHandler` maps every exception to Problem Details.

- **Status is decided by the exception type.** Feature exceptions derive from the shared type whose status they mean (`OrderClosedException : ConflictException`). The handler therefore never names a feature exception, and it does not grow as features are added. Before, the rule was one handler per exception family, and each new family meant another handler class and another registration whose order mattered.
- **The 500 path.** An exception the handler does not recognize becomes a 500 with a generic title and no detail. Since .NET 10, the exception handler middleware suppresses its own logs and metrics for exceptions an `IExceptionHandler` handles ([breaking change](https://learn.microsoft.com/aspnet/core/breaking-changes/10/exception-handler-diagnostics-suppressed)). The handler therefore logs 5xx itself through `[LoggerMessage]`.
- **Client disconnects.** An `OperationCanceledException` after the client disconnects gets a 499 and no body. No response would reach the client, and logging it as an error would be noise.
- **Every error body has the same shape.** `CustomizeProblemDetails` adds `instance` and `traceId` to every Problem Details response, whether the handler, `UseStatusCodePages`, or the validation filter wrote it.

### D4. `DateTimeOffset` timestamps

`DateCreated`, `DateModified`, and `DateDeleted` are `DateTimeOffset` values at offset zero (`TimeProvider.GetUtcNow()`).

- **Why.** A `DateTime` loses its `Kind` on the round trip through the database, so a value read back is ambiguous. `DateTimeOffset` is unambiguous, and it maps to native types: `datetimeoffset` on SQL Server and `timestamp with time zone` on PostgreSQL. Npgsql accepts only offset zero, which `GetUtcNow()` guarantees.
- **Cost.** The SQLite provider can compare `DateTimeOffset` values for equality but cannot compare or order them in SQL ([limitations](https://learn.microsoft.com/ef/core/providers/sqlite/limitations#query-limitations)). The soft-delete filter (`== null`) still runs on SQLite. A test that filters or sorts by a stamp, such as purge, moves to Testcontainers or the dedicated test database.

### D5. `andes-scaffold` in `andes-core`

One user-invoked skill creates `<name>-api/` and/or `<name>-ui/` at the repository root.

- **Why `andes-core`.** It is a single entry point that handles `api`, `ui`, or `both`. A per-stack pair of skills would split the naming rule and the proxy wiring across two plugins. When a stack plugin is missing, the skill says so and skips that part.
- **Commands only, no code.** `references/api.md` and `references/ui.md` hold the order of work and the commands. Every file they create is written to the stack skill named beside it. The scaffold therefore cannot drift from the standards, and it has no templates of its own to maintain.
- **Layout choice.** The six .NET projects sit directly in `<name>-api/` beside `<Root>.slnx`, with no `src/` folder, and the two test projects go under `test/`. `<name>-api/` is already scoped to one API, so a `src/` level adds depth without separating anything. The Angular CLI owns the UI layout: `ng new` creates `<name>-ui/` and its own `src/app/`, and the UI dev proxy reads `<name>-api/<Root>.Api/Properties/launchSettings.json`.
- **Not included.** The scaffold ships no sample feature and no initial migration. The first entity brings both through the normal flow.

## Enforcement

- **The `AGENTS.md` block (`v1.4.0`)** adds "services query the `DbContext` directly (no repositories)" to the `*.cs` non-negotiables. The block is now 649 words.
- **Reviewers.** Both C# reviewer twins gain a **Data access** check: repository classes, `AddAsync`, and `DateTime` stamps are Medium. Their error checks add a second `IExceptionHandler` or endpoint try/catch error responses (Medium) and exception detail in a 5xx body (High).
- **Audit.** `csharp-policy/banned-pattern` now also matches `AddAsync` / `AddRangeAsync`, `*Repository` type names, and `<Entity>Repository` in skill and agent text. Lines phrased as prohibitions pass.

## Not verified

- **The scaffold end to end.** No run of `andes-scaffold` has produced a solution and a workspace that build, test, and lint. The skill makes those checks its own exit condition.
- **The handler sample has not been compiled.** Each API it uses was checked against Microsoft Learn: `IExceptionHandler`, `IProblemDetailsService.TryWriteAsync`, `HttpValidationProblemDetails`, `ProblemDetailsOptions.CustomizeProblemDetails`, and `StatusCodes.Status499ClientClosedRequest`.

## References

- EF Core, Add versus AddAsync: <https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#add-versus-addasync>
- EF Core, DbContext versus DbSet methods: <https://learn.microsoft.com/ef/core/change-tracking/miscellaneous#dbcontext-versus-dbset-methods>
- ASP.NET Core, `IExceptionHandler` and Problem Details: <https://learn.microsoft.com/aspnet/core/fundamentals/error-handling>
- .NET 10 breaking change, exception diagnostics suppressed: <https://learn.microsoft.com/aspnet/core/breaking-changes/10/exception-handler-diagnostics-suppressed>
- SQLite provider query limitations: <https://learn.microsoft.com/ef/core/providers/sqlite/limitations>
