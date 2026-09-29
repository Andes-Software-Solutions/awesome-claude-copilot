---
name: dotnet-api-architecture
description: "Use when adding, moving, renaming, or registering files, folders, or projects in a .NET solution shaped Api → Service → Repository → Entity → Common (+ Dto), or when asked where a type goes or what to call it: project and folder placement, type and DI-method names, grouped model files, options and validators, provider-first repositories, and the mirrored Unit/Integration test layout."
---

# .NET API architecture

Where a file goes and what it is called in a minimal-API solution shaped `<Root>.Api → <Root>.Service → <Root>.Repository → <Root>.Entity`, plus `<Root>.Dto` and `<Root>.Common`, tested by `<Root>.Unit.Test` and `<Root>.Integration.Test`. This skill fixes placement and names. Code shape is `csharp-standards`, endpoint shape `aspnet-rest-apis`, mapping practice `ef-core`, the test stack `csharp-xunit`. Record a solution's own folder map, adopted names, and sanctioned deviations in its `AGENTS.md` sections (`## Layout`, `## Conventions`), not here.

Placeholders: `<Root>` = solution prefix (`Contoso.Shop`); `<Feature>` = plural noun (`Orders`, `Documents`); `<Entity>` = singular (`Order`); `<Provider>` = a persistence technology (`Sql`, `Mongo`, `Blob`); `<Technique>` = gerund or mass noun for a sub-pipeline a feature owns (`Extraction`, `Tokenization`); `<Area>` = an options section (`Export`, `Telemetry`); `<Prefix>` = one fixed product word on infrastructure DI methods and the DbContext (`AddContoso…`, `ContosoDbContext`).

## Layering

- Project references: `Api → Service → Repository → Entity → Common`, `Dto → Common`, and `Service → Dto`. `Entity` and `Repository` never reference `Dto`; `Common` references no project; `Entity` takes no EF Core package — every mapping lives in `Repository/<Provider>/Configurations/`.
- **The composition root declares what it names.** `Api` carries a `ProjectReference` to every project whose types appear in its source — commonly `Service`, `Repository`, and `Dto` — because it registers them. Transitive flow is never relied on to make a type compile.
- No `Abstractions` project, no AutoMapper. Interfaces live with their implementations and exist so tests can substitute them; mapping is hand-written static classes.
- **A `Service` type is never named after a storage technology.** `<Provider>` words appear only inside `Repository/<Provider>/`. A service that persists through `I<Entity>Repository` is named for what it does (`CartService`, `SessionCache`), not for the store behind it (`RedisCartService`).

## Rules that apply everywhere

- **Namespace == path under `RootNamespace`.** `<Root>.Service/Documents/Extraction/X.cs` declares `namespace <Root>.Service.Documents.Extraction;`. Moving a file changes its namespace and nothing else. `Program.cs` declares no namespace. Enforce it in `.editorconfig` (`references/naming.md`).
- **No loose `.cs` at a project root.** Every type is inside a folder.
- **Folder names:** collections of like types are plural (`Endpoints`, `Options`, `Configurations`, `<Feature>`); techniques and infrastructure are a gerund or mass noun (`Extraction`, `Caching`, `Middleware`, `Provisioning`); persistence providers carry the technology's proper name (`Sql`, `Mongo`).
- **File name == type name, with three sanctioned exceptions** (the groupings `csharp-standards` defers to): grouped model files per leaf folder — non-service classes in `<Folder>Classes.cs`, records in `<Folder>Records.cs`, structs and record structs in `<Folder>Structs.cs`, const-only holders in `<Folder>Constants.cs`, exceptions in `<Folder>Exceptions.cs`; an interface with its single implementation in one file named after the implementation, interface first; a validator in the file of the type it validates. A static class with method bodies keeps its own file; nested and private types stay nested; enums are never grouped.
- **Interfaces with two or more implementations, or whose implementations live in a subfolder**, go to `<Feature>/Interfaces/I<Name>.cs`, one per file.
- **Options.** `<Area>Options` classes, each with `public const string SectionName`, live in the `Options/` folder of the lowest project that reads them — `Api/Options/` for host concerns, `Service/Options/` for business knobs, `Repository/<Provider>/Options/` for store settings, never a shared one at the Repository root. Binding and validation: `references/options-and-validation.md`.
- **Validators** (FluentValidation only, per `csharp-standards`): one `AbstractValidator<T>` per validated type, declared in the same file as that type.
- **Enums** all live in `Common/Enums/`, one per file, named in the plural (`OrderStatuses`) so they never collide with an entity; a wire-name companion is `<Enum>Names` in the owning Service feature. **Constants** (string and Guid catalogs, const-only) all live in `Common/Constants/`. Dto, Entity, Service, and Api hold no enums and no catalogs.
- **Exceptions** are grouped in `<Folder>Exceptions.cs` beside the code that throws them. The only `Exceptions/` folder is `Service/Exceptions/`, holding just `NotFoundException` and `ForbiddenException`. A provider exception never reaches Api untranslated: `Repository/<Provider>/` throws a store-shaped exception, the Service feature catches it and rethrows the domain exception the handler maps, so swapping the store changes nothing above Service.
- **Tests mirror source.** `tests/<Root>.Unit.Test/<ProjectShortName>/<Folder>/<Type>Tests.cs` (ProjectShortName ∈ Api, Service, Repository, Entity, Dto, Common); integration tests by feature folder plus `Endpoints/`, `Health/`, `Middleware/`. `TestInfrastructure/` at each test project root holds every fixture, fake, builder, and collection definition — no helper types beside tests, no `*Tests` class inside it. A behaviour-named file (`<Behaviour>Tests.cs`) is allowed only when there is no single subject type. This skill is authoritative for the test-project layout; `csharp-xunit` for the test stack.
- **Shipped assets move with their code** (prompt templates, fonts): the csproj item and the `AppContext.BaseDirectory` constant that reads it change in the same commit; keep the output path with `Link` when the source folder moves.

## Solution map

```text
<Root>.Api          Program.cs · Configuration/ (+Providers/) · Endpoints/ · ExceptionHandlers/ · Filters/ · Health/ · Middleware/ · Observability/ · Options/ · Problems/ · Startup/
<Root>.Service      <Feature>/ (+Interfaces/, +<Technique>/) · BackgroundJobs/ · Caching/ · Exceptions/ · Observability/ · Options/ · Prompts/ · Security/ · Serialization/ · Sorting/
<Root>.Repository   <Feature>/ (Interfaces/, Records, Exceptions — store-agnostic) · <Provider>/ (everything one technology needs)
<Root>.Entity       Base/ · <Feature>/ — plain classes, one file per entity, no mapping attributes
<Root>.Dto          Actions/<Feature>/ (request DTOs + validators) · <Feature>/ (response DTOs) · Pagination/
<Root>.Common       Constants/ · Enums/ · Extensions/ · Validation/
tests/<Root>.Unit.Test         Api/ Service/ Repository/ Entity/ Dto/ Common/ · TestInfrastructure/
tests/<Root>.Integration.Test  Endpoints/ · <Feature>/ · Health/ · Middleware/ · TestInfrastructure/
```

Full trees and what each folder holds: `references/project-layout.md`.

## Decision table — "You are adding…"

| You are adding… | It goes in… | Named… |
|---|---|---|
| an endpoint module | `Api/Endpoints/` | `<Entity>Endpoints.cs`, `Map<Entity>Endpoints` — the `<Resource>Endpoints` of `aspnet-rest-apis`, which fixes the handler shape |
| a DI registration for a feature | `Api/Configuration/` | `<Feature>Configuration.cs`, `Add<Feature>(this IServiceCollection, IConfiguration)`; drop the `IConfiguration` parameter when the feature binds no options |
| a DI registration for infrastructure | `Api/Configuration/`, or the owning `Api/{Health,Middleware,Observability,Problems}/` | `<Concern>Configuration.cs` / `<Concern>Registration.cs`, `Add<Prefix><Concern>` |
| a per-provider registration for a model or external API | `Api/Configuration/Providers/` | `<Provider>ProviderConfiguration.cs`, `Add<Provider>Provider` |
| **a persistence provider** | `Repository/<Provider>/` | the technology's proper name — `Sql/`, `Mongo/` |
| **a persistence registration** | `Repository/<Provider>/` | `<Provider>PersistenceConfiguration.cs`, `Add<Prefix><Provider>Persistence`, called from `Program.cs`; `Api/Configuration/` holds no store wiring |
| **a store health probe** | `Repository/<Provider>/HealthChecks/` | `<Provider>HealthCheck.cs`, internal, exposed through `Add<Prefix><Provider>HealthCheck`; the name, tag, and route stay in `Api/Health/HealthRegistration.cs` |
| **a store provisioner or schema migrator** | `Repository/<Provider>/Provisioning/` | `<Provider>ResourceProvisioner.cs` / `<Provider>SchemaMigrator.cs`, public; run by an `Api/Startup/<Name>Bootstrapper.cs` |
| an options class read only by Api | `Api/Options/` | `<Area>Options.cs` with `SectionName` + validator |
| an options class read by Service | `Service/Options/` | `<Area>Options.cs` with `SectionName` + validator |
| **an options class read by a store** | `Repository/<Provider>/Options/` | `<Provider>DbOptions.cs` with `SectionName` + validator |
| **a validator** | the file of the type it validates | `<Type>Validator : AbstractValidator<<Type>>` |
| a service | `Service/<Feature>/` | `<Entity>Service.cs` (`I<Entity>Service` first) |
| an interface with one implementation | the implementation's file | `I<Impl>` above `<Impl>` |
| an interface with 2+ implementations, or one whose implementations live in a subfolder | `<Feature>/Interfaces/` | `I<Name>.cs` |
| a mapper | `Service/<Feature>/` | `<Entity>Mapper.cs`, static, `MapTo<Entity>Dto` + `MapTo<Entity>DtoExpression` |
| a request DTO or its validator | `Dto/Actions/<Feature>/` | `<Entity>Actions.cs`; `Create<Entity>ActionDto` + `Create<Entity>ActionDtoValidator`; `List<Entities>ActionDto` for query parameters (`[AsParameters]`) |
| a response DTO | `Dto/<Feature>/` | `<Entity>Dto.cs` |
| an entity | `Entity/<Feature>/` | `<Entity>.cs` — a plain class; every mapping lives in its EF configuration |
| a repository contract | `Repository/<Feature>/Interfaces/` | `I<Entity>Repository.cs` |
| a repository implementation | `Repository/<Provider>/<Feature>/` | `<Provider><Entity>Repository.cs` |
| an EF configuration | `Repository/<Provider>/Configurations/<Feature>/` | `<Entity>Configuration.cs` — keys, column lengths and precision, row version, keyless, relationships, indexes, check constraints, conversions, seed data (`ef-core`) |
| a migration | `Repository/<Provider>/Migrations/` | `dotnet ef migrations add <Verb><Subject>` |
| **an EF interceptor** | `Repository/<Provider>/Interceptors/` | `<Name>Interceptor.cs`, internal, one per file; attached in `<Provider>PersistenceConfiguration.cs` |
| an enum | `Common/Enums/` | `<Enums>.cs`, plural |
| an enum's wire names | `Service/<Feature>/` | `<Enum>Names.cs`, static |
| a constant catalog | `Common/Constants/` | `<Catalog>.cs` (`PermissionIds`, `TelemetryNames`) |
| a record / struct / non-service class | the leaf folder's grouped file | `<Folder>Records.cs` / `<Folder>Structs.cs` / `<Folder>Classes.cs` |
| a feature exception | `Service/<Feature>/` (or its `<Technique>/`) | `<Folder>Exceptions.cs` |
| a store exception | `Repository/<Feature>/` | `<Folder>Exceptions.cs`; Service translates it before it reaches Api |
| a solution-wide exception | `Service/Exceptions/` | only `NotFoundException`, `ForbiddenException` |
| a static helper with method bodies | beside its callers | own file, named for what it does (`<Subject>Sql.cs`, `<Subject>Calculator.cs`) |
| a background job | `Service/BackgroundJobs/` (shared) or `Service/<Feature>/` (feature-owned) | `<Subject>Processor.cs`, `<Subject>Queue.cs` (`<Subject>Channel` when CA1711 rejects a public `…Queue`) |
| a cache | `Service/Caching/` | `<Subject>Cache.cs` with `I<Subject>Cache`; `<Subject>CacheOptions` in `Service/Options/` |
| a shipped asset (prompt, template, font) | beside the code that reads it | kebab-case file; csproj `<None>` + `Link`; `AppContext.BaseDirectory` constant |
| a middleware | `Api/Middleware/` | `<Name>Middleware.cs` + `<Name>Registration.cs` |
| an endpoint filter | `Api/Filters/` | `<Name>EndpointFilter.cs`; the validation filter of `aspnet-rest-apis` lives here |
| an exception handler | `Api/ExceptionHandlers/` | `<Name>ExceptionHandler.cs`, one `IExceptionHandler` per file |
| a health check that is not a store probe | `Api/Health/` | `<Name>HealthCheck.cs`; registered in `HealthRegistration.cs` |
| a startup validator | `Api/Startup/` | `<Name>Bootstrapper.cs` |
| a unit test | `tests/<Root>.Unit.Test/<ProjectShortName>/<Folder>/` | `<Type>Tests.cs` |
| an integration test | `tests/<Root>.Integration.Test/<Feature>/` or `Endpoints/` | `<Subject>IntegrationTests.cs` |
| test infrastructure | `tests/<Root>.*.Test/TestInfrastructure/` | `<Subject>Fixture.cs`, `Fake<Name>.cs` implementing `I<Name>`, `<Name>Collection.cs` |

## Never

- No loose `.cs` at a project root; no `Models/`, `Helpers/`, `Utils/`, `Tool/`, `Settings/`, or `Mappers/` folders in Service; no `Exceptions/` folder anywhere but `Service/Exceptions/`, and nothing in it beyond the two shared types.
- No `Abstractions` project, no AutoMapper, no `*Settings` classes, no `Configure<T>` — options bind through `AddOptions<T>()` (`references/options-and-validation.md`).
- No enums or constant catalogs in Dto, Entity, Service, or Api — they live in Common.
- No provider name on a type outside `Repository/<Provider>/`; no provider-specific code in Service or Api, including client construction in the composition root.
- No shared `Options/` or `Serialization/` folder at the Repository root when provider folders exist — each provider owns its own.
- No interface-only file for a 1:1 pair; no file named after the interface when it also holds the implementation.
- No mapping attributes on an entity and no constants class for column lengths or precision — they live in the `IEntityTypeConfiguration<T>`; no model-owned (`HasData`) seed for rows operators change after release — write those as `InsertData` in the migration that creates the table.
- No test helper types outside `TestInfrastructure/`; no `*Tests` class inside it.
- Never regenerate a migration to absorb a CLR rename; edit the type-name strings and verify with `dotnet ef migrations has-pending-model-changes`.
- Framework bans (controllers, validation attributes, OpenAPI tooling) are not restated here; `csharp-standards` and `aspnet-rest-apis` own them.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| `references/project-layout.md` | Scaffolding a solution, project, provider folder, or feature end to end; the thing you are adding is not in the decision table; you need to know what a folder holds before touching it |
| `references/naming.md` | Naming a type, file, folder, DI method, test, or fake; reviewing names; the `.editorconfig` lines that enforce namespace == folder |
| `references/options-and-validation.md` | Adding or binding an options class, placing or registering a validator, or a validator that never runs |
| `references/persistence.md` | Adding a persistence provider, repository, EF configuration, interceptor, migration, provisioner, or store health probe; adding a second store; a store exception reaching Api |
