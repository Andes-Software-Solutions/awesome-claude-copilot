# Project layout

The full trees, project by project. Placeholders are the skill's: `<Root>`, `<Feature>`, `<Entity>`, `<Provider>`, `<Technique>`, `<Area>`, `<Prefix>`. Every leaf folder follows the same rule: working types at its root, everything else in `Models/`, `Exceptions/`, `Constants/`, or `Interfaces/`, one type per file.

## `<Root>.Api`

```text
<Root>.Api/
├─ Program.cs                       top-level statements; sequences Add…/Map…/Use… calls, registers nothing itself
├─ appsettings.json  appsettings.sample.json
├─ Configuration/                   all dependency injection
│  ├─ <Feature>Configuration.cs     internal static; Add<Feature>(this IServiceCollection[, IConfiguration]) — registers the feature's services and repositories; plural, so it never collides with an EF <Entity>Configuration
│  ├─ <Concern>Configuration.cs     Add<Prefix><Concern> for Authentication, Cors, KeyVault, DataProtection, ExceptionHandling…
│  ├─ Models/                       records the registrations share, one per file
│  └─ Providers/                    one <Provider>ProviderConfiguration.cs (+ <Provider>Defaults.cs) per external model or API provider
├─ Endpoints/                       minimal-API modules
│  └─ <Entity>Endpoints.cs          Map<Entity>Endpoints(this IEndpointRouteBuilder); handler shape per aspnet-rest-apis
├─ ExceptionHandlers/               <Name>ExceptionHandler.cs, one IExceptionHandler per file (NotFound, Forbidden, Conflict, Validation…)
├─ Filters/                         <Name>EndpointFilter.cs — endpoint filters, including the validation filter of aspnet-rest-apis
├─ Health/                          <Name>HealthCheck.cs, probes, HealthRegistration.cs — the policy (names, tags, routes) even when a probe lives with its provider
├─ Middleware/                      <Name>Middleware.cs + <Name>Registration.cs + LoggerMessage partials
├─ Observability/                   telemetry enrichers and processors + TelemetryRegistration.cs
├─ Options/                         <Area>Options.cs read only by Api (Telemetry, RequestLogging, KeyVault), each with its validator
├─ Problems/                        ProblemDetailsRegistration.cs; Constants/ProblemTypes.cs (wire contract); Models/ for the problem shapes
├─ Properties/                      launchSettings.json
└─ Startup/                         <Name>Bootstrapper.cs — validators and bootstrappers that run after Build()
```

Persistence is registered by calling the provider's own `Add<Prefix><Provider>Persistence` from `Program.cs`; `Api/Configuration/` holds no store wiring of its own. Repositories are registered by `Add<Feature>`, next to the services that use them.

## `<Root>.Service`

```text
<Root>.Service/
├─ <Feature>/                       one folder per feature, mirroring Api/Endpoints
│  ├─ <Entity>Service.cs            I<Entity>Service + <Entity>Service in one file, interface first
│  ├─ <Entity>Repository.cs         I<Entity>Repository + <Entity>Repository in one file, interface first; takes the DbContext (ctx / _ctx); translates store faults into Exceptions/ or the shared types
│  ├─ <Entity>Mapper.cs             static MapTo<Entity>Dto + Expression<Func<<Entity>, <Entity>Dto>> projection
│  ├─ <Enum>Names.cs                wire-name companion of a Common enum this feature owns
│  ├─ Models/                       every other class, record, struct, or record struct of this folder — one per file
│  ├─ Exceptions/                   <Condition>Exception.cs — one per file, including the ones store faults are translated into
│  ├─ Constants/                    const-only static holders shared inside this folder — one per file
│  ├─ Interfaces/                   only when an interface has 2+ implementations or they live in a subfolder
│  │  └─ I<Name>.cs
│  └─ <Technique>/                  a sub-pipeline the feature owns; the same rules apply recursively
│     ├─ <Variant><Technique-agent>.cs   e.g. <Format>TextExtractor.cs, <Format>ExportRenderer.cs
│     ├─ Models/  Exceptions/  Constants/
│     └─ <Assets>/                  shipped files the technique reads (fonts, templates) + their resolver
├─ BackgroundJobs/                  queue, processor, status store; Models/ Constants/ Exceptions/
├─ Caching/                         <Subject>Cache.cs (I<Subject>Cache in the same file); Models/
├─ Exceptions/                      NotFoundException.cs, ForbiddenException.cs, ConflictException.cs — nothing else
├─ Observability/                   metrics and tracing statics
├─ Options/                         <Area>Options.cs, each with public const string SectionName and its validator
├─ Prompts/                         PromptTemplateLoader.cs + shipped *.md templates — only when the service ships prompt templates
├─ Security/                        caller identity, secret protection
├─ Serialization/                   converters and serializer settings
└─ Sorting/                         shared sort-key resolution; Models/
```

A repository is named for what it does, never for the store (`OrderRepository`, not `SqlOrderRepository`). It uses the `DbContext` and the provider-agnostic EF Core API only; the one provider word it contains is the `using` for the context's namespace. A non-EF store is reached through the `I<Subject>Store` gateway its provider folder exposes.

## `<Root>.Repository`

Provider-first and plumbing-only: everything one technology needs sits in its own folder, so a second store is a sibling rather than a refactor, and nothing here is a repository. The rules for what each provider folder owns are in `persistence.md`.

```text
<Root>.Repository/
└─ <Provider>/                      Sql/, Mongo/, Blob/ — everything one technology needs
   ├─ <Provider>PersistenceConfiguration.cs   public static Add<Prefix><Provider>Persistence(IServiceCollection, IConfiguration) — DbContext, interceptors, options, health probe; never a repository
   ├─ <Provider>Queries.cs  <Provider>Containers.cs   client, connection, and query plumbing with method bodies
   ├─ Models/  Constants/  Exceptions/       the provider's own shapes, catalogs, and store-shaped exceptions — one type per file
   ├─ HealthChecks/<Provider>HealthCheck.cs   internal; exposed through Add<Prefix><Provider>HealthCheck(IHealthChecksBuilder, …)
   ├─ Options/<Provider>DbOptions.cs          + its validator, in the same file
   ├─ Provisioning/                 <Provider>ResourceProvisioner.cs, <Provider>SchemaMigrator.cs — create or migrate the store when an Api/Startup bootstrapper asks
   ├─ Serialization/                converters and serializer settings this store needs
   ├─ DbContexts/                   EF providers only: <Prefix>DbContext.cs
   ├─ Configurations/               EF providers only: Base/Base<Thing>Configuration.cs (abstract, shared) + <Feature>/<Entity>Configuration.cs mirroring the Entity folders
   ├─ Interceptors/                 EF providers only: <Name>Interceptor.cs, one per file — SoftDeleteInterceptor, AuditTimestampInterceptor, command and connection interceptors
   ├─ Migrations/                   EF providers only: `dotnet ef migrations add` output
   ├─ Scripts/                      EF providers only: <Verb><Subject>.sql embedded resources (views, procedures, operator seeds) + <Provider>Scripts.cs, the reader migrations call
   └─ <Provider><Subject>Store.cs   non-EF providers only: I<Subject>Store + the gateway over the client, interface first
```

A non-EF store simply has no `DbContexts/`, `Configurations/`, `Interceptors/`, `Migrations/`, or `Scripts/`; it exposes gateways instead.

## `<Root>.Entity`

```text
<Root>.Entity/
├─ Base/                            BaseEntity.cs, BaseCreatedEntity.cs, BaseModifiedEntity.cs (ef-core-base-entities); BaseEnumEntity.cs (ef-core-enum-reference-tables); other abstract Base<Thing>.cs shared by aggregates
└─ <Feature>/                       one file per entity: <Entity>.cs, <Entity><Child>.cs, <EnumSingular>.cs for an enum reference table; Models/ and Constants/ for non-relational documents
```

Entities are plain classes: no mapping attributes, no EF Core package reference, `Entity → Common` only. Keys, column lengths and precision, row versions, relationships, indexes, check constraints, value conversions, and seed data all live in `Repository/<Provider>/Configurations/` (`ef-core` for the practice).

## `<Root>.Dto`

```text
<Root>.Dto/
├─ Actions/<Feature>/               folder is the plural of the entity
│  ├─ Create<Entity>ActionDto.cs    the record + Create<Entity>ActionDtoValidator in the same file
│  ├─ Update<Entity>ActionDto.cs  Delete<Entity>ActionDto.cs
│  └─ List<Entities>ActionDto.cs    the query-parameter shape, bound with [AsParameters]
├─ <Feature>/                       response DTOs, one per file
│  └─ <Entity>Dto.cs  <Entity><Child>Dto.cs
└─ Pagination/                      PaginatedResponseDto.cs and other shapes every feature shares, one per file
```

`List<Entities>ActionDto` is validated only where the endpoint attaches the validation filter (`options-and-validation.md`).

## `<Root>.Common`

```text
<Root>.Common/
├─ Constants/                       <Catalog>.cs — const / static readonly string and Guid catalogs, no methods
├─ Enums/                           <Enums>.cs — one enum per file, plural name
├─ Extensions/                      <Type>Extensions.cs — extension methods on BCL or Common types
└─ Validation/                      the FluentValidation-to-IValidateOptions adapter and its OptionsBuilder extension
```

`Validation/` sits here because every layer that registers options needs it and `Common` is the only project all of them share. It is the one place `Common` takes package references.

## Tests

```text
tests/<Root>.Unit.Test/
├─ Api/<Folder>/<Type>Tests.cs      mirrors <Root>.Api
├─ Service/<Feature>/<Type>Tests.cs   services, repositories (against the csharp-xunit database ladder), mappers; <Technique>/ nested
├─ Repository/<Provider>/           configurations, interceptors, scripts, provisioning
├─ Entity/  Dto/  Common/
└─ TestInfrastructure/              fixtures, fakes, builders, collection definitions, KnownIds.cs

tests/<Root>.Integration.Test/
├─ Endpoints/<Entity>EndpointsIntegrationTests.cs
├─ <Feature>/<Subject>IntegrationTests.cs
├─ Health/  Middleware/             infrastructure behaviour through the real pipeline
└─ TestInfrastructure/              WebApplicationFactory subclass, auth handler, container fixtures, seeds
```

## Shipped assets

A file the code reads at runtime (a prompt template, a font, an export template) lives beside the code that reads it. The csproj item and the `AppContext.BaseDirectory` constant that reads it change in the same commit. The output path is a deployment contract: use `Link` to keep it when the source folder moves. Glob a directory of like files (`Skills\**\*.md`, `Prompts\*.md`); enumerate a single file. SQL scripts are the exception: they are embedded resources, read from the assembly, never copied to the output.
