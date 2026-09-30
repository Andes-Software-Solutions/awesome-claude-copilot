# Scaffold `<name>-api/`

These are the order of work and the commands. Load `csharp-standards` and `dotnet-api-architecture` before you start. The trees, names, and code come from the skills each step names. Placeholders are the ones `dotnet-api-architecture` uses, filled from the answers: `<Root>`, `<Prefix>`, and `<Provider>`. All paths below are relative to `<name>-api/`.

```text
<name>-api/
├─ <Root>.slnx  global.json  Directory.Build.props  Directory.Packages.props  .editorconfig  .gitignore
├─ <Root>.Api/  <Root>.Service/  <Root>.Repository/
├─ <Root>.Entity/  <Root>.Dto/  <Root>.Common/
└─ test/
   ├─ <Root>.Unit.Test/
   └─ <Root>.Integration.Test/
```

The six projects sit directly in `<name>-api/`, with no `src/` folder; only the test projects get their own `test/` folder.

## 1. Solution and projects

1. `dotnet new sln --name <Root>`. .NET 10 writes `<Root>.slnx`.
2. `dotnet new globaljson` pinned to the installed SDK with `--roll-forward latestFeature`, and `dotnet new gitignore`.
3. `dotnet new webapi --name <Root>.Api --output <Root>.Api`. Minimal APIs is the template default; never pass `--use-controllers`.
4. `dotnet new classlib` for `<Root>.Service`, `<Root>.Repository`, `<Root>.Entity`, `<Root>.Dto`, and `<Root>.Common`, each with `--output <Root>.<Project>`.
5. `dotnet new xunit3` for `<Root>.Unit.Test` and `<Root>.Integration.Test`, each with `--output test/<Root>.<Project>`. Apply the Microsoft Testing Platform settings from `csharp-xunit`. Install the template first if it is missing (`dotnet new install xunit.v3.templates`).
6. `dotnet sln add` every project.
7. Add project references exactly as the layering in `dotnet-api-architecture` lists them:
   - `Api` → `Service`, `Repository`, `Dto`, `Common`
   - `Service` → `Repository`, `Dto`
   - `Repository` → `Entity`
   - `Entity` → `Common`
   - `Dto` → `Common`
   - `Unit.Test` → all six source projects
   - `Integration.Test` → `Api`
8. Delete the template leftovers: `WeatherForecast`, the sample endpoint in `Program.cs`, `Class1.cs`, `UnitTest1.cs`, and the `.http` file.

## 2. Build settings

- **`Directory.Build.props`:** the TFM the SDK targets (`net10.0`), `Nullable` enabled, `ImplicitUsings` enabled, `TreatWarningsAsErrors`, `EnforceCodeStyleInBuild`, and `AnalysisLevel` `latest-recommended`. Remove these properties from each csproj.
- **`Directory.Packages.props`:** set `ManagePackageVersionsCentrally` and add one `PackageVersion` per package. Take each latest stable version from NuGet, never from memory:
  - `FluentValidation.DependencyInjectionExtensions`
  - `Microsoft.EntityFrameworkCore.SqlServer` (or the chosen store's provider) and `Microsoft.EntityFrameworkCore.Design`
  - `Microsoft.AspNetCore.OpenApi` and `Scalar.AspNetCore`
  - the `csharp-xunit` stack: `xunit.v3`, `NSubstitute`, `NSubstitute.Analyzers.CSharp`, `Microsoft.AspNetCore.Mvc.Testing`, and `Testcontainers.MsSql` (or the chosen engine)
  - `Microsoft.Extensions.TimeProvider.Testing`
- **`.editorconfig`:** `dotnet new editorconfig`, then add:
  - the `var`, primary-constructor, and collection-expression preferences from `csharp-standards`
  - the namespace-folder lines and `CA1717` from `dotnet-api-architecture` `references/naming.md`
  - the generated-code glob for `**/<Provider>/Migrations/*.cs`
- **Api csproj:** `<InternalsVisibleTo Include="<Root>.Unit.Test" />` so the unit tests reach the `internal` handler.

## 3. Infrastructure

Write each file to the skill in parentheses and to the `csharp-standards` layout. Create each folder only when this step puts a file in it; no empty folders and no placeholder files.

| File | Skill |
| --- | --- |
| `Api/Program.cs`: top-level statements that sequence the `Add…` / `Use…` / `Map…` calls below, plus `public partial class Program;` | `aspnet-rest-apis`, `dotnet-api-architecture` |
| `Api/ExceptionHandlers/GlobalExceptionHandler.cs`, `Api/Problems/ProblemDetailsRegistration.cs`, `Api/Problems/Constants/ProblemTypes.cs` | `aspnet-rest-apis` `references/exception-handling.md` |
| `Api/Filters/ValidationEndpointFilter.cs` | `aspnet-rest-apis` |
| OpenAPI (`AddOpenApi` / `MapOpenApi`) and Scalar in development only, registered in `Api/Configuration/OpenApiConfiguration.cs` | `aspnet-rest-apis` |
| `Api/Health/HealthRegistration.cs`: liveness plus the store probe | `dotnet-api-architecture` |
| `Service/Exceptions/NotFoundException.cs`, `ForbiddenException.cs`, `ConflictException.cs` | `dotnet-api-architecture` |
| `Entity/Base/BaseEntity.cs`, `BaseCreatedEntity.cs`, `BaseModifiedEntity.cs` | `ef-core-base-entities` |
| `Repository/<Provider>/`: `<Provider>PersistenceConfiguration.cs`, `DbContexts/<Prefix>DbContext.cs`, `Options/<Provider>DbOptions.cs`, `Configurations/Base/`, `Interceptors/SoftDeleteInterceptor.cs` and `AuditTimestampInterceptor.cs`, `HealthChecks/<Provider>HealthCheck.cs` | `dotnet-api-architecture` `references/persistence.md`, `ef-core-base-entities` |
| `Common/Validation/`: the FluentValidation-to-`IValidateOptions<T>` adapter and `ValidateWithFluentValidation()` | `dotnet-api-architecture` `references/options-and-validation.md` |
| `Dto/Pagination/PaginatedResponseDto.cs` | `dotnet-api-architecture` |
| `appsettings.json` with the `<Provider>DbOptions` section and an empty connection string; `appsettings.sample.json` documenting it. The development connection string goes in user secrets, never in a committed file | `dotnet-api-architecture` |

No initial migration: the first one comes with the first entity (`dotnet ef migrations add <Verb><Subject>`).

## 4. Tests

- `test/<Root>.Unit.Test/Api/ExceptionHandlers/GlobalExceptionHandlerTests.cs`: one row per mapping, per `references/exception-handling.md`.
- `test/<Root>.Unit.Test/Repository/<Provider>/Interceptors/`: the stamp and soft-delete tests with `FakeTimeProvider` (`ef-core-base-entities`).
- `test/<Root>.Integration.Test/TestInfrastructure/`: the `WebApplicationFactory<Program>` subclass and the Testcontainers fixture for the chosen engine, which applies migrations when there are any (`csharp-xunit`).
- `test/<Root>.Integration.Test/Health/`: the health endpoint returns 200, which proves the host and store wiring.
