---
name: dotnet-api-architecture
description: "Use when adding, moving, renaming, or registering files, folders, or projects in a .NET solution shaped Api → Service → Repository → Entity → Common (+ Dto), or when asked where a type goes or what to call it: placement, one type per file (Models/, Exceptions/ subfolders), type and DI names, options and validators, services over provider-owned persistence (no repositories), and the test layout."
---

# .NET API architecture

Where a file goes and what it is called in a minimal-API solution shaped `<Root>.Api → <Root>.Service → <Root>.Repository → <Root>.Entity`, plus `<Root>.Dto` and `<Root>.Common`, tested by `<Root>.Unit.Test` and `<Root>.Integration.Test`. `Service` owns the services, which query the `DbContext` directly — there are no repository classes; `Repository` owns persistence plumbing only. This skill fixes placement and names. Code shape is `csharp-standards`, endpoint shape `aspnet-rest-apis`, mapping practice `ef-core` (base entities `ef-core-base-entities`, lookup tables `ef-core-enum-reference-tables`), the test stack `csharp-xunit`. Record a solution's own folder map, adopted names, and sanctioned deviations in its `AGENTS.md` sections (`## Layout`, `## Conventions`), not here.

Placeholders: `<Root>` = solution prefix (`Contoso.Shop`); `<Feature>` = plural noun (`Orders`, `Documents`); `<Entity>` = singular (`Order`); `<Provider>` = a persistence technology (`Sql`, `Mongo`, `Blob`); `<Technique>` = gerund or mass noun for a sub-pipeline a feature owns (`Extraction`, `Tokenization`); `<Area>` = an options section (`Export`, `Telemetry`); `<Prefix>` = one fixed product word on infrastructure DI methods and the DbContext (`AddContoso…`, `ContosoDbContext`).

## Layering

- Project references: `Api → Service → Repository → Entity → Common`, `Dto → Common`, and `Service → Dto`. `Entity` and `Repository` never reference `Dto`; `Common` references no project; `Entity` takes no EF Core package — every mapping lives in `Repository/<Provider>/Configurations/`. `Service` reaches the EF Core API through its reference to `Repository`, which is where the `DbContext` lives.
- **The composition root declares what it names.** `Api` carries a `ProjectReference` to every project whose types appear in its source — commonly `Service`, `Repository`, and `Dto` — because it registers them. Transitive flow is never relied on to make a type compile. `Add<Feature>` in `Api/Configuration/` registers a feature's services; `Repository` cannot see `Service`, so a provider's `Add<Prefix><Provider>Persistence` registers plumbing only.
- No `Abstractions` project, no AutoMapper. Interfaces live with their implementations and exist so tests can substitute them; mapping is hand-written static classes.
- **A `Service` type is never named after a storage technology.** `<Provider>` words appear only inside `Repository/<Provider>/`. A service is named for what it does (`OrderService`, `CartService`, `SessionCache`), not for the store behind it (never `SqlOrderService` or `RedisCartService`). Service uses the `DbContext` and the provider-agnostic EF Core API; provider types, client construction, and connection strings stay in `Repository/<Provider>/`.

## Rules that apply everywhere

- **Namespace == path under `RootNamespace`.** `<Root>.Service/Documents/Extraction/X.cs` declares `namespace <Root>.Service.Documents.Extraction;`. Moving a file changes its namespace and nothing else. `Program.cs` declares no namespace. Enforce it in `.editorconfig` (`references/naming.md`).
- **No loose `.cs` at a project root.** Every type is inside a folder.
- **Folder names:** collections of like types are plural (`Endpoints`, `Options`, `Configurations`, `Models`, `Exceptions`, `<Feature>`); techniques and infrastructure are a gerund or mass noun (`Extraction`, `Caching`, `Middleware`, `Provisioning`); persistence providers carry the technology's proper name (`Sql`, `Mongo`).
- **One type per file, kind-first subfolders.** A leaf folder keeps its working types at its root — services, mappers, endpoint modules, handlers, filters, middleware, static helpers with method bodies — and sorts everything else into subfolders, one type per file: `Models/` for classes, records, structs, and record structs; `Exceptions/` for `<Condition>Exception.cs`; `Constants/` for const-only static holders shared inside the folder (a const used by one type is a `private const` on that type; solution-wide catalogs stay in `Common/Constants/`); `Interfaces/` per the rule below. No `<Folder>Records.cs`, `<Folder>Classes.cs`, `<Folder>Structs.cs`, `<Folder>Constants.cs`, or `<Folder>Exceptions.cs` grouping files. Nested and private types stay nested; enums are never grouped and live in `Common/Enums/`.
- **File name == type name, with two sanctioned exceptions:** an interface with its single implementation in one file named after the implementation, interface first; a validator in the file of the type it validates.
- **Interfaces with two or more implementations, or whose implementations live in a subfolder**, go to `<Feature>/Interfaces/I<Name>.cs`, one per file.
- **Services own data access.** `Service/<Feature>/<Entity>Service.cs` takes the `DbContext` through its primary constructor (parameter `ctx`, field `_ctx`), queries it directly, and is registered by `Add<Feature>`. The `DbContext` is already the unit of work and each `DbSet` a repository, so there is no `I<Entity>Repository` / `<Entity>Repository`, no generic `IRepository<T>`, and no unit-of-work wrapper — in any project.
- **Options.** `<Area>Options` classes, each with `public const string SectionName`, live in the `Options/` folder of the lowest project that reads them — `Api/Options/` for host concerns, `Service/Options/` for business knobs, `Repository/<Provider>/Options/` for store settings, never a shared one at the Repository root. Binding and validation: `references/options-and-validation.md`.
- **Validators** (FluentValidation only, per `csharp-standards`): one `AbstractValidator<T>` per validated type, declared in the same file as that type.
- **Enums** all live in `Common/Enums/`, one per file, named in the plural (`OrderStatuses`) so they never collide with an entity or an enum reference table (`OrderStatus`); a wire-name companion is `<Enum>Names` in the owning Service feature. **Constants** (string and Guid catalogs, const-only) all live in `Common/Constants/`. Dto, Entity, Service, and Api hold no enums and no catalogs.
- **Exceptions** are one per file in the `Exceptions/` subfolder of the folder whose code throws them (`Service/<Feature>/Exceptions/<Condition>Exception.cs`). `Service/Exceptions/` holds only the three solution-wide types: `NotFoundException`, `ForbiddenException`, `ConflictException`. A feature exception derives from the shared type whose status it means (`OrderClosedException : ConflictException`). A store fault never reaches Api untranslated: the service in `Service/<Feature>/` catches `DbUpdateConcurrencyException`, `DbUpdateException`, and provider exceptions and throws the feature's domain exception or one of the three shared types, so Api's `GlobalExceptionHandler` names no EF Core, provider, or feature type.
- **Tests mirror source.** `tests/<Root>.Unit.Test/<ProjectShortName>/<Folder>/<Type>Tests.cs` (ProjectShortName ∈ Api, Service, Repository, Entity, Dto, Common); integration tests by feature folder plus `Endpoints/`, `Health/`, `Middleware/`. `TestInfrastructure/` at each test project root holds every fixture, fake, builder, and collection definition — no helper types beside tests, no `*Tests` class inside it. A behaviour-named file (`<Behaviour>Tests.cs`) is allowed only when there is no single subject type. This skill is authoritative for the test-project layout; `csharp-xunit` for the test stack.
- **Shipped assets move with their code** (prompt templates, fonts): the csproj item and the `AppContext.BaseDirectory` constant that reads it change in the same commit; keep the output path with `Link` when the source folder moves.

## Solution map

```text
<Root>.Api          Program.cs · Configuration/ (+Models/, +Providers/) · Endpoints/ · ExceptionHandlers/ · Filters/ · Health/ · Middleware/ · Observability/ · Options/ · Problems/ · Startup/
<Root>.Service      <Feature>/ (+Models/, +Exceptions/, +Constants/, +Interfaces/, +<Technique>/) · BackgroundJobs/ · Caching/ · Exceptions/ · Observability/ · Options/ · Prompts/ · Security/ · Serialization/ · Sorting/
<Root>.Repository   <Provider>/ only — DbContexts/ · Configurations/ (+Base/) · Migrations/ · Scripts/ · Interceptors/ · Options/ · HealthChecks/ · Provisioning/ · Serialization/ · Models/
<Root>.Entity       Base/ (BaseEntity, BaseCreatedEntity, BaseModifiedEntity, BaseEnumEntity) · <Feature>/ — plain classes, one file per entity, no mapping attributes
<Root>.Dto          Actions/<Feature>/ (one action DTO + its validator per file) · <Feature>/ (one response DTO per file) · Pagination/
<Root>.Common       Constants/ · Enums/ · Extensions/ · Validation/
tests/<Root>.Unit.Test         Api/ Service/ Repository/ Entity/ Dto/ Common/ · TestInfrastructure/
tests/<Root>.Integration.Test  Endpoints/ · <Feature>/ · Health/ · Middleware/ · TestInfrastructure/
```

Full trees and what each folder holds: `references/project-layout.md`.

## Decision table — "You are adding…"

| You are adding… | It goes in… | Named… |
|---|---|---|
| an endpoint module | `Api/Endpoints/` | `<Entity>Endpoints.cs`, `Map<Entity>Endpoints` — the `<Resource>Endpoints` of `aspnet-rest-apis`, which fixes the handler shape |
| a DI registration for a feature | `Api/Configuration/` | `<Feature>Configuration.cs`, `Add<Feature>(this IServiceCollection, IConfiguration)` — registers the feature's services; drop the `IConfiguration` parameter when the feature binds no options |
| a DI registration for infrastructure | `Api/Configuration/`, or the owning `Api/{Health,Middleware,Observability,Problems}/` | `<Concern>Configuration.cs` / `<Concern>Registration.cs`, `Add<Prefix><Concern>` |
| a per-provider registration for a model or external API | `Api/Configuration/Providers/` | `<Provider>ProviderConfiguration.cs`, `Add<Provider>Provider` |
| **a persistence provider** | `Repository/<Provider>/` | the technology's proper name — `Sql/`, `Mongo/` |
| **a persistence registration** | `Repository/<Provider>/` | `<Provider>PersistenceConfiguration.cs`, `Add<Prefix><Provider>Persistence`, called from `Program.cs`; registers the DbContext, interceptors, options, and health probe — never a service; `Api/Configuration/` holds no store wiring |
| **a store health probe** | `Repository/<Provider>/HealthChecks/` | `<Provider>HealthCheck.cs`, internal, exposed through `Add<Prefix><Provider>HealthCheck`; the name, tag, and route stay in `Api/Health/HealthRegistration.cs` |
| **a store provisioner or schema migrator** | `Repository/<Provider>/Provisioning/` | `<Provider>ResourceProvisioner.cs` / `<Provider>SchemaMigrator.cs`, public; run by an `Api/Startup/<Name>Bootstrapper.cs` |
| an options class read only by Api | `Api/Options/` | `<Area>Options.cs` with `SectionName` + validator |
| an options class read by Service | `Service/Options/` | `<Area>Options.cs` with `SectionName` + validator |
| **an options class read by a store** | `Repository/<Provider>/Options/` | `<Provider>DbOptions.cs` with `SectionName` + validator |
| **a validator** | the file of the type it validates | `<Type>Validator : AbstractValidator<<Type>>` |
| a service | `Service/<Feature>/` | `<Entity>Service.cs` (`I<Entity>Service` first); injects the `DbContext` as `ctx` and queries it; translates store faults; registered by `Add<Feature>` |
| an interface with one implementation | the implementation's file | `I<Impl>` above `<Impl>` |
| an interface with 2+ implementations, or one whose implementations live in a subfolder | `<Feature>/Interfaces/` | `I<Name>.cs` |
| a mapper | `Service/<Feature>/` | `<Entity>Mapper.cs`, static, `MapTo<Entity>Dto` + `MapTo<Entity>DtoExpression` |
| a request DTO or its validator | `Dto/Actions/<Feature>/` | `Create<Entity>ActionDto.cs` holding `Create<Entity>ActionDto` + `Create<Entity>ActionDtoValidator`; `Update<Entity>ActionDto.cs`; `List<Entities>ActionDto.cs` for query parameters (`[AsParameters]`) — one DTO per file |
| a response DTO | `Dto/<Feature>/` | `<Entity>Dto.cs`, `<Entity><Child>Dto.cs` — one per file |
| an entity | `Entity/<Feature>/` | `<Entity>.cs` — a plain class deriving from the shallowest `Entity/Base/` class that fits (`ef-core-base-entities`); every mapping lives in its EF configuration |
| **a base entity** | `Entity/Base/` | `BaseEntity`, `BaseCreatedEntity`, `BaseModifiedEntity` (`ef-core-base-entities`); `BaseEnumEntity<TEnum>` (`ef-core-enum-reference-tables`) |
| **an enum reference table** | `Entity/<Feature>/` | `<EnumSingular>.cs`, sealed, `: BaseEnumEntity<<Enums>>` (`OrderStatus : BaseEnumEntity<OrderStatuses>`) |
| an EF configuration | `Repository/<Provider>/Configurations/<Feature>/` | `<Entity>Configuration.cs` deriving from the matching `Base<Thing>Configuration<T>` — keys, column lengths and precision, row version, keyless, relationships, indexes, check constraints, conversions, seed data (`ef-core`) |
| **a shared EF base configuration** | `Repository/<Provider>/Configurations/Base/` | `Base<Thing>Configuration<T>`, abstract; `Configure` maps the base then calls `ConfigureEntity` |
| a migration | `Repository/<Provider>/Migrations/` | `dotnet ef migrations add <Verb><Subject>` |
| **a SQL script (view, procedure, seed)** | `Repository/<Provider>/Scripts/` | `<Verb><Subject>.sql`, an `<EmbeddedResource>` named after the migration that runs it through `migrationBuilder.Sql(<Provider>Scripts.Read("<Verb><Subject>"))` |
| **an EF interceptor** | `Repository/<Provider>/Interceptors/` | `<Name>Interceptor.cs`, internal, one per file; attached in `<Provider>PersistenceConfiguration.cs` |
| **a non-EF store client** | `Repository/<Provider>/` | `<Provider><Subject>Store.cs` (`I<Subject>Store` first) — a thin gateway over the client so no provider type reaches Service; no business queries or domain rules |
| an enum | `Common/Enums/` | `<Enums>.cs`, plural |
| an enum's wire names | `Service/<Feature>/` | `<Enum>Names.cs`, static |
| a constant catalog | `Common/Constants/` | `<Catalog>.cs` (`PermissionIds`, `TelemetryNames`) |
| a record / struct / non-service class | the leaf folder's `Models/` | `<TypeName>.cs`, one per file |
| a folder-local constant holder | the leaf folder's `Constants/` | `<Name>.cs`; a const one type uses is a `private const` on that type |
| a feature exception | `Service/<Feature>/Exceptions/` (or `<Technique>/Exceptions/`) | `<Condition>Exception.cs`, one per file, deriving from the shared type whose status it means |
| a store fault (EF Core or provider exception) | caught in `Service/<Feature>/<Entity>Service.cs` | rethrown as the feature's `Exceptions/<Condition>Exception` or `NotFoundException` / `ForbiddenException` / `ConflictException` |
| a solution-wide exception | `Service/Exceptions/` | only `NotFoundException`, `ForbiddenException`, `ConflictException` (409, row-version conflicts) |
| a static helper with method bodies | beside its callers | own file, named for what it does (`<Subject>Sql.cs`, `<Subject>Calculator.cs`) |
| a background job | `Service/BackgroundJobs/` (shared) or `Service/<Feature>/` (feature-owned) | `<Subject>Processor.cs`, `<Subject>Queue.cs` (`<Subject>Channel` when CA1711 rejects a public `…Queue`) |
| a cache | `Service/Caching/` | `<Subject>Cache.cs` with `I<Subject>Cache`; `<Subject>CacheOptions` in `Service/Options/` |
| a shipped asset (prompt, template, font) | beside the code that reads it | kebab-case file; csproj `<None>` + `Link`; `AppContext.BaseDirectory` constant |
| a middleware | `Api/Middleware/` | `<Name>Middleware.cs` + `<Name>Registration.cs` |
| an endpoint filter | `Api/Filters/` | `<Name>EndpointFilter.cs`; the validation filter of `aspnet-rest-apis` lives here |
| the exception handler | `Api/ExceptionHandlers/` | `GlobalExceptionHandler.cs`, the one `IExceptionHandler` (`aspnet-rest-apis` `references/exception-handling.md`); a new exception derives from a shared type instead of adding a handler |
| a health check that is not a store probe | `Api/Health/` | `<Name>HealthCheck.cs`; registered in `HealthRegistration.cs` |
| a startup validator | `Api/Startup/` | `<Name>Bootstrapper.cs` |
| a unit test | `tests/<Root>.Unit.Test/<ProjectShortName>/<Folder>/` | `<Type>Tests.cs` |
| an integration test | `tests/<Root>.Integration.Test/<Feature>/` or `Endpoints/` | `<Subject>IntegrationTests.cs` |
| test infrastructure | `tests/<Root>.*.Test/TestInfrastructure/` | `<Subject>Fixture.cs`, `Fake<Name>.cs` implementing `I<Name>`, `<Name>Collection.cs` |

## Never

Only the bans not already stated as rules above.

- No repository classes (`I<Entity>Repository`, `IRepository<T>`), unit-of-work wrappers, or `Repositories/` folders over an EF Core `DbContext` — the service queries the context.
- No `Helpers/`, `Utils/`, `Tool/`, `Settings/`, or `Mappers/` folders.
- No `*Settings` classes, no `Configure<T>` — options bind through `AddOptions<T>()` (`references/options-and-validation.md`).
- No shared `Options/` or `Serialization/` folder at the Repository root when provider folders exist — each provider owns its own.
- No mapping attributes on an entity (no DataAnnotations, no `[Timestamp]`) and no constants class for column lengths or precision — they live in the `IEntityTypeConfiguration<T>`; no model-owned (`HasData`) seed for rows operators change after release — write those as `InsertData` in the migration that creates the table, or as a `Scripts/` file that migration runs.
- Never regenerate a migration to absorb a CLR rename; edit the type-name strings and verify with `dotnet ef migrations has-pending-model-changes`.
- Framework bans (controllers, validation attributes, OpenAPI tooling) are not restated here; `csharp-standards` and `aspnet-rest-apis` own them.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| `references/project-layout.md` | Scaffolding a solution, project, provider folder, or feature end to end; the thing you are adding is not in the decision table; you need to know what a folder holds before touching it |
| `references/naming.md` | Naming a type, file, folder, DI method, test, or fake; the two file-name exceptions and the kind-first subfolders; reviewing names; the `.editorconfig` lines that enforce namespace == folder |
| `references/options-and-validation.md` | Adding or binding an options class, placing or registering a validator, or a validator that never runs |
| `references/persistence.md` | Adding a persistence provider, EF configuration or base configuration, interceptor, migration, SQL script, provisioner, or store health probe; querying the store from a service; adding a second store; a store fault reaching Api |
