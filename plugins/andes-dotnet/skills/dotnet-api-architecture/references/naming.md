# Naming

## Naming table

| Thing | Convention | Examples |
|---|---|---|
| Projects | `<Root>.<Layer>`; tests `<Root>.Unit.Test`, `<Root>.Integration.Test` | `Contoso.Shop.Service` |
| Folders — collections of like types | plural | `Endpoints`, `Enums`, `Options`, `Configurations`, `HealthChecks`, `Interceptors`, `<Feature>` |
| Folders — techniques and infrastructure | gerund or mass noun | `Extraction`, `Caching`, `Middleware`, `Health`, `Observability`, `Configuration`, `Provisioning`, `Validation` |
| Folders — persistence providers | the technology's proper name | `Sql`, `Mongo`, `Blob` |
| File names | == the type name, with three exceptions: grouped files, an interface with its single implementation, a validator beside the type it validates | `OrderService.cs` (holds `IOrderService` too); `OrdersRecords.cs`; `ExportOptions.cs` holding `ExportOptionsValidator` |
| Grouped files | `<Folder>Classes/Records/Structs/Constants/Exceptions.cs` | `ExtractionRecords.cs` |
| Services | `<Entity>Service` / `I<Entity>Service` | `OrderService` |
| Repositories | contract `I<Entity>Repository`; implementation `<Provider><Entity>Repository` | `IOrderRepository` / `SqlOrderRepository` |
| Mappers | `<Entity>Mapper`, static | `OrderMapper` |
| Options | `<Area>Options`, `SectionName` | `ExportOptions` |
| Validators | `<Type>Validator` | `ExportOptionsValidator`, `CreateOrderActionDtoValidator` |
| DI extension classes (Api) | `<Feature>Configuration` (plural) | `OrdersConfiguration` vs EF `OrderConfiguration` |
| DI extension classes (Repository) | `<Provider>PersistenceConfiguration` | `SqlPersistenceConfiguration` |
| DI extension methods | `Add<Feature>` for features; `Add<Prefix><Thing>` for infrastructure; `Add<Prefix><Provider><Concern>` for a store | `AddOrders`; `AddContosoCors`; `AddContosoSqlPersistence` |
| `*Registration` | reserved for `Api/{Health,Middleware,Observability,Problems}` | `TelemetryRegistration` |
| Endpoint modules | `<Entity>Endpoints`, `Map<Entity>Endpoints` (the `<Resource>Endpoints` of `aspnet-rest-apis`) | `OrderEndpoints` |
| Filters | `<Name>EndpointFilter` | `PermissionEndpointFilter`, `ValidationEndpointFilter` |
| Exception handlers | `<Name>ExceptionHandler` | `ValidationExceptionHandler` |
| Health checks | `<Name>HealthCheck` | `DatabaseHealthCheck` |
| DbContext | `<Prefix>DbContext` in `Repository/<Provider>/DbContexts/` | `ContosoDbContext` |
| An injected `DbContext` | primary-constructor parameter `ctx`, field `_ctx`, whatever the context type — never `_dbContext` or `_context` | `private readonly ContosoDbContext _ctx = ctx;` |
| EF interceptors | `<Name>Interceptor`, named for what it does | `AuditTimestampInterceptor`, `SoftDeleteInterceptor` |
| Store provisioning | `<Provider>ResourceProvisioner` creates resources; `<Provider>SchemaMigrator` applies migrations | `MongoResourceProvisioner`, `SqlSchemaMigrator` |
| Startup | `<Name>Bootstrapper` | `SchemaBootstrapper` |
| Enums | plural, one per file | `JobStatuses`, `SortDirections` |
| Enum wire names | `<Enum>Names` | `JobStatusNames` |
| Actions | `Actions/<Feature>/<Entity>Actions.cs` | `Actions/Orders/OrderActions.cs` |
| Exceptions | `<Condition>Exception`; grouped in `<Folder>Exceptions.cs` | `StorageNotConfiguredException` |
| Background jobs | `<Subject>Processor`, `<Subject>Queue`; `<Subject>Channel` where CA1711 rejects a public `…Queue` | `SummaryProcessor`, `SummaryChannel` |
| Tests | `<Type>Tests`; integration `<Subject>IntegrationTests` | `OrderServiceTests` |
| Fakes | `Fake<Name>` implementing `I<Name>` | `FakeGraphService` |
| Shipped assets | kebab-case | `order-summary-prompt.md` |

Plural enum names collide with analyzer CA1717 ("only FlagsAttribute enums should have plural names") if that rule is enabled; set `dotnet_diagnostic.CA1717.severity = none` in `.editorconfig` when adopting the convention.

## The three file-name exceptions

- **Grouped files.** Per leaf folder: non-service classes → `<Folder>Classes.cs`; records → `<Folder>Records.cs`; structs and record structs → `<Folder>Structs.cs`; const-only static holders → `<Folder>Constants.cs`; exceptions → `<Folder>Exceptions.cs`. A static class with method bodies keeps its own file. Nested and private types stay nested. Enums never live here (`Common/Enums/`, one per file).
- **Interface + single implementation.** Same file, named after the implementation, interface declared first. Two or more implementations, or implementations that live in a subfolder → `<Feature>/Interfaces/I<Name>.cs`, one per file. A nested namespace sees its parent, so an interface in `<Feature>/Interfaces/` needs no `using` for types in `<Feature>/` — IDE0005 flags one as unnecessary.
- **Validator + validated type.** One `AbstractValidator<T>` per validated type, in the same file as `T` (`options-and-validation.md`).

## Enforcing namespace == folder

```ini
# .editorconfig — IDE0130 is severity-less by default and would let a moved file build clean
dotnet_style_namespace_match_folder = true
dotnet_diagnostic.IDE0130.severity = warning
```

The warning reaches the build only with `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` in `Directory.Build.props`; with `TreatWarningsAsErrors` it fails CI.
