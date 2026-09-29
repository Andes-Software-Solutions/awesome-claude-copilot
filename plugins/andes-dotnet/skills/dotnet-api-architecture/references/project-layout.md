# Project layout

The full trees, project by project. Placeholders are the skill's: `<Root>`, `<Feature>`, `<Entity>`, `<Provider>`, `<Technique>`, `<Area>`, `<Prefix>`.

## `<Root>.Api`

```text
<Root>.Api/
├─ Program.cs                       top-level statements; sequences Add…/Map…/Use… calls, registers nothing itself
├─ appsettings.json  appsettings.sample.json
├─ Configuration/                   all dependency injection
│  ├─ <Feature>Configuration.cs     internal static; Add<Feature>(this IServiceCollection[, IConfiguration]) — plural, so it never collides with an EF <Entity>Configuration
│  ├─ <Concern>Configuration.cs     Add<Prefix><Concern> for Authentication, Cors, KeyVault, DataProtection, ExceptionHandling…
│  ├─ ConfigurationRecords.cs       records the registrations share
│  └─ Providers/                    one <Provider>ProviderConfiguration.cs (+ <Provider>Defaults.cs) per external model or API provider
├─ Endpoints/                       minimal-API modules
│  └─ <Entity>Endpoints.cs          Map<Entity>Endpoints(this IEndpointRouteBuilder); handler shape per aspnet-rest-apis
├─ ExceptionHandlers/               <Name>ExceptionHandler.cs, one IExceptionHandler per file
├─ Filters/                         <Name>EndpointFilter.cs — endpoint filters, including the validation filter of aspnet-rest-apis
├─ Health/                          <Name>HealthCheck.cs, probes, HealthRegistration.cs — the policy (names, tags, routes) even when a probe lives with its provider
├─ Middleware/                      <Name>Middleware.cs + <Name>Registration.cs + LoggerMessage partials
├─ Observability/                   telemetry enrichers and processors + TelemetryRegistration.cs
├─ Options/                         <Area>Options.cs read only by Api (Telemetry, RequestLogging, KeyVault), each with its validator
├─ Problems/                        ProblemTypes.cs (wire contract), ProblemsStructs.cs, ProblemDetailsRegistration.cs
├─ Properties/                      launchSettings.json
└─ Startup/                         <Name>Bootstrapper.cs — validators and bootstrappers that run after Build()
```

Persistence is registered by calling the provider's own `Add<Prefix><Provider>Persistence` from `Program.cs`; `Api/Configuration/` holds no store wiring of its own.

## `<Root>.Service`

```text
<Root>.Service/
├─ <Feature>/                       one folder per feature, mirroring Api/Endpoints
│  ├─ <Entity>Service.cs            I<Entity>Service + <Entity>Service in one file, interface first
│  ├─ <Entity>Mapper.cs             static MapTo<Entity>Dto + Expression<Func<<Entity>, <Entity>Dto>> projection
│  ├─ <Enum>Names.cs                wire-name companion of a Common enum this feature owns
│  ├─ <Feature>Classes.cs           every non-service top-level class of this folder
│  ├─ <Feature>Records.cs           every top-level record of this folder
│  ├─ <Feature>Structs.cs           every struct and record struct of this folder
│  ├─ <Feature>Constants.cs         const-only static holders of this folder
│  ├─ <Feature>Exceptions.cs        every exception only this feature throws, including the ones it translates store faults into
│  ├─ Interfaces/                   only when an interface has 2+ implementations or they live in a subfolder
│  │  └─ I<Name>.cs
│  └─ <Technique>/                  a sub-pipeline the feature owns; the same file rules apply recursively
│     ├─ <Variant><Technique-agent>.cs   e.g. <Format>TextExtractor.cs, <Format>ExportRenderer.cs
│     ├─ <Technique>Records.cs  <Technique>Structs.cs  <Technique>Exceptions.cs
│     └─ <Assets>/                  shipped files the technique reads (fonts, templates) + their resolver
├─ BackgroundJobs/                  queue, processor, status store; BackgroundJobsRecords/Constants/Exceptions.cs
├─ Caching/                         <Subject>Cache.cs (I<Subject>Cache in the same file); CachingClasses/Structs.cs
├─ Exceptions/                      NotFoundException.cs, ForbiddenException.cs — nothing else
├─ Observability/                   metrics and tracing statics
├─ Options/                         <Area>Options.cs, each with public const string SectionName and its validator
├─ Prompts/                         PromptTemplateLoader.cs + shipped *.md templates — only when the service ships prompt templates
├─ Security/                        caller identity, secret protection
├─ Serialization/                   converters and serializer settings
└─ Sorting/                         shared sort-key resolution; SortingStructs.cs
```

## `<Root>.Repository`

Provider-first: store-agnostic contracts sit at the top, and everything one technology needs sits in its own folder, so a second store is a sibling rather than a refactor. The rules for what each provider folder owns are in `persistence.md`.

```text
<Root>.Repository/
├─ <Feature>/                       store-agnostic; nothing here names a provider
│  ├─ Interfaces/I<Entity>Repository.cs   one per file — the implementations live in a provider subfolder
│  ├─ <Feature>Records.cs           read/result shapes the contract exposes (e.g. an entity plus its concurrency token)
│  └─ <Feature>Exceptions.cs        store-shaped exceptions the contract documents, thrown by every provider
└─ <Provider>/                      Sql/, Mongo/, Blob/ — everything one technology needs
   ├─ <Provider>PersistenceConfiguration.cs   public static Add<Prefix><Provider>Persistence(IServiceCollection, IConfiguration)
   ├─ <Provider>Queries.cs  <Provider>Records.cs  <Provider>Containers.cs   client, connection and query plumbing
   ├─ HealthChecks/<Provider>HealthCheck.cs   internal; exposed through Add<Prefix><Provider>HealthCheck(IHealthChecksBuilder, …)
   ├─ Options/<Provider>DbOptions.cs          + its validator, in the same file
   ├─ Provisioning/                 <Provider>ResourceProvisioner.cs, <Provider>SchemaMigrator.cs — create or migrate the store when an Api/Startup bootstrapper asks
   ├─ Serialization/                converters and serializer settings this store needs
   ├─ DbContexts/  Configurations/  Migrations/   EF providers only: <Prefix>DbContext.cs, IEntityTypeConfiguration<T> mirroring the Entity folders, `dotnet ef migrations add` output
   ├─ Interceptors/                 EF providers only: <Name>Interceptor.cs, one per file — save-changes, command and connection interceptors
   └─ <Feature>/<Provider><Entity>Repository.cs   the implementation, named for the store it talks to
```

A non-EF store simply has no `DbContexts/`, `Configurations/`, `Interceptors/`, or `Migrations/`.

## `<Root>.Entity`

```text
<Root>.Entity/
├─ Base/                            BaseEntity.cs and the abstract Base<Thing>.cs shared by aggregates
└─ <Feature>/                       one file per entity: <Entity>.cs, <Entity><Child>.cs; <Feature>Records/Constants.cs for non-relational documents
```

Entities are plain classes: no mapping attributes, no EF Core package reference, `Entity → Common` only. Keys, column lengths and precision, row versions, relationships, indexes, check constraints, value conversions, and seed data all live in `Repository/<Provider>/Configurations/` (`ef-core` for the practice).

## `<Root>.Dto`

```text
<Root>.Dto/
├─ Actions/<Feature>/               folder is the plural of the file prefix
│  └─ <Entity>Actions.cs            Create/Update/Delete<Entity>ActionDto, List<Entities>ActionDto, and their FluentValidation validators
├─ <Feature>/                       response DTOs, one type family per file
│  └─ <Entity>Dto.cs  <Entity><Child>Dto.cs
└─ Pagination/                      PaginatedResponseDto.cs and other shapes every feature shares
```

`List<Entities>ActionDto` is the query-parameter shape, bound with `[AsParameters]`. It is validated only where the endpoint attaches the validation filter (`options-and-validation.md`).

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
├─ Service/<Feature>/<Technique>/<Type>Tests.cs
├─ Repository/  Entity/  Dto/  Common/
└─ TestInfrastructure/              fixtures, fakes, builders, collection definitions, KnownIds.cs

tests/<Root>.Integration.Test/
├─ Endpoints/<Entity>EndpointsIntegrationTests.cs
├─ <Feature>/<Subject>IntegrationTests.cs
├─ Health/  Middleware/             infrastructure behaviour through the real pipeline
└─ TestInfrastructure/              WebApplicationFactory subclass, auth handler, container fixtures, seeds
```

## Shipped assets

A file the code reads at runtime (a prompt template, a font, an export template) lives beside the code that reads it. The csproj item and the `AppContext.BaseDirectory` constant that reads it change in the same commit. The output path is a deployment contract: use `Link` to keep it when the source folder moves. Glob a directory of like files (`Skills\**\*.md`, `Prompts\*.md`); enumerate a single file.
