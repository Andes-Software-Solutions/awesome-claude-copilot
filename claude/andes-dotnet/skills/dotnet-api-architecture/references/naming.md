# Naming

## Naming table

| Thing | Convention | Examples |
|---|---|---|
| Projects | `<Root>.<Layer>`; tests `<Root>.Unit.Test`, `<Root>.Integration.Test` | `Contoso.Shop.Service` |
| Folders — collections of like types | plural | `Endpoints`, `Enums`, `Options`, `Configurations`, `HealthChecks`, `Interceptors`, `Limits`, `Models`, `Exceptions`, `Constants`, `Scripts`, `<Feature>` |
| Folders — techniques and infrastructure | gerund or mass noun | `Extraction`, `Caching`, `Middleware`, `Health`, `Observability`, `Configuration`, `Provisioning`, `Validation` |
| Folders — persistence providers | the technology's proper name | `Sql`, `Mongo`, `Blob` |
| File names | == the type name, with two exceptions: an interface with its single implementation, a validator beside the type it validates | `OrderService.cs` (holds `IOrderService` too); `SessionCache.cs` (holds `ISessionCache` too); `ExportOptions.cs` holding `ExportOptionsValidator` |
| Kind-first subfolders | `Models/`, `Exceptions/`, `Constants/`, `Interfaces/` under the leaf folder, one type per file | `Orders/Models/OrderSummary.cs`, `Orders/Exceptions/OrderClosedException.cs` |
| Services | `<Entity>Service` / `I<Entity>Service`; the service queries the `DbContext`, so there is no repository type to name; never a provider prefix | `OrderService` |
| Store gateways (non-EF providers) | `I<Subject>Store` / `<Provider><Subject>Store` in `Repository/<Provider>/` | `IDocumentStore` / `BlobDocumentStore` |
| Mappers | `<Entity>Mapper`, static | `OrderMapper` |
| Options | `<Area>Options`, `SectionName` | `ExportOptions` |
| Validators | `<Type>Validator` | `ExportOptionsValidator`, `CreateOrderActionDtoValidator` |
| DI extension classes (Api) | `<Feature>Configuration` (plural) | `OrdersConfiguration` vs EF `OrderConfiguration` |
| DI extension classes (Repository) | `<Provider>PersistenceConfiguration` | `SqlPersistenceConfiguration` |
| DI extension methods | `Add<Feature>` for features (their services); `Add<Prefix><Thing>` for infrastructure; `Add<Prefix><Provider><Concern>` for a store | `AddOrders`; `AddContosoCors`; `AddContosoSqlPersistence` |
| `*Registration` | reserved for `Api/{Health,Middleware,Observability,Problems}` | `TelemetryRegistration` |
| Endpoint modules | `<Entity>Endpoints`, `Map<Entity>Endpoints` (the `<Resource>Endpoints` of `aspnet-rest-apis`) | `OrderEndpoints` |
| Filters | `<Name>EndpointFilter` | `PermissionEndpointFilter`, `ValidationEndpointFilter` |
| Exception handler | `GlobalExceptionHandler`, the only `IExceptionHandler` in the solution | `GlobalExceptionHandler` |
| Health checks | `<Name>HealthCheck` | `DatabaseHealthCheck` |
| DbContext | `<Prefix>DbContext` in `Repository/<Provider>/DbContexts/` | `ContosoDbContext` |
| An injected `DbContext` | primary-constructor parameter `ctx`, field `_ctx`, whatever the context type — never `_dbContext` or `_context` | `private readonly ContosoDbContext _ctx = ctx;` |
| Base entities | `Base<Thing>Entity` in `Entity/Base/` | `BaseEntity`, `BaseCreatedEntity`, `BaseModifiedEntity`, `BaseEnumEntity<TEnum>` |
| Enum reference tables | the singular of the enum, sealed, `: BaseEnumEntity<<Enums>>` | `OrderStatus : BaseEnumEntity<OrderStatuses>` |
| EF configurations | `<Entity>Configuration`, deriving from a shared `Base<Thing>Configuration<T>` in `Configurations/Base/` | `OrderConfiguration : BaseModifiedEntityConfiguration<Order>` |
| EF interceptors | `<Name>Interceptor`, named for what it does | `AuditTimestampInterceptor`, `SoftDeleteInterceptor` |
| SQL scripts | `<Verb><Subject>.sql`, named after the migration that runs it | `CreateOrderSummaryView.sql` ↔ migration `CreateOrderSummaryView` |
| Store provisioning | `<Provider>ResourceProvisioner` creates resources; `<Provider>SchemaMigrator` applies migrations | `MongoResourceProvisioner`, `SqlSchemaMigrator` |
| Startup | `<Name>Bootstrapper` | `SchemaBootstrapper` |
| Enums | plural, one per file | `JobStatuses`, `SortDirections` |
| Entity limits | `<Entity>Limits` in `Common/Limits/`, static, const-only, named for the class that declares the property; members `<Property>MaxLength`, `<Property>MinLength`, `<Property>Length` (fixed), `<Property>Precision`, `<Property>Scale`, `<Property>MinValue`, `<Property>MaxValue` | `ProductLimits.NameMaxLength`, `BaseEnumEntityLimits.NameMaxLength` |
| Enum wire names | `<Enum>Names` | `JobStatusNames` |
| Actions | `Actions/<Feature>/<Verb><Entity>ActionDto.cs`, one DTO per file with its validator | `Actions/Orders/CreateOrderActionDto.cs` |
| Exceptions | `<Condition>Exception`, one per file in the owning folder's `Exceptions/`; shared: `NotFoundException`, `ForbiddenException`, `ConflictException` | `StoreUnavailableException` |
| Background jobs | `<Subject>Processor`, `<Subject>Queue`; `<Subject>Channel` where CA1711 rejects a public `…Queue` | `SummaryProcessor`, `SummaryChannel` |
| Tests | `<Type>Tests`; integration `<Subject>IntegrationTests` | `OrderServiceTests` |
| Fakes | `Fake<Name>` implementing `I<Name>` | `FakeGraphService` |
| Shipped assets | kebab-case | `order-summary-prompt.md` |

Plural enum names collide with analyzer CA1717 ("only FlagsAttribute enums should have plural names") if that rule is enabled; set `dotnet_diagnostic.CA1717.severity = none` in `.editorconfig` when adopting the convention.

## The two file-name exceptions

- **Interface + single implementation.** Same file, named after the implementation, interface declared first — services, caches, and store gateways all follow it. Two or more implementations, or implementations that live in a subfolder → `<Feature>/Interfaces/I<Name>.cs`, one per file. A nested namespace sees its parent, so an interface in `<Feature>/Interfaces/` needs no `using` for types in `<Feature>/` — IDE0005 flags one as unnecessary.
- **Validator + validated type.** One `AbstractValidator<T>` per validated type, in the same file as `T` (`options-and-validation.md`).

## Kind-first subfolders

Everything else is one type per file, named after the type, sorted by kind under the leaf folder: `Models/` (classes, records, structs, record structs), `Exceptions/` (`<Condition>Exception.cs`), `Constants/` (const-only static holders shared in the folder; a const one type uses is a `private const` on it; solution-wide catalogs are `Common/Constants/`), `Interfaces/` (per the rule above). Working types — services, mappers, endpoint modules, handlers, filters, middleware, static helpers with method bodies — stay at the folder root. There are no `<Folder>Records.cs`-style grouping files; nested and private types stay nested; enums live only in `Common/Enums/`, one per file.

## Enforcing namespace == folder

```ini
# .editorconfig — IDE0130 is severity-less by default and would let a moved file build clean
dotnet_style_namespace_match_folder = true
dotnet_diagnostic.IDE0130.severity = warning
```

The warning reaches the build only with `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` in `Directory.Build.props`; with `TreatWarningsAsErrors` it fails CI.
