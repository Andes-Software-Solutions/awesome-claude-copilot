---
name: aspnet-rest-apis
description: "Use when building or reviewing ASP.NET Core Web APIs (Minimal APIs only, never controllers): endpoint groups, TypedResults, FluentValidation endpoint filters, Problem Details, Entra ID/JWT auth, versioning, OpenAPI, caching, rate limits and timeouts, health checks, and container deployment."
---

# ASP.NET Core REST APIs

## Instructions

- Build REST APIs on ASP.NET Core 10 with **Minimal APIs only**. Never add MVC controllers, `[ApiController]`, `AddControllers()`, or `MapControllers()`; scaffold with `dotnet new webapi` (its default is Minimal APIs — never pass `--use-controllers`).
- General C# standards live in `csharp-standards`; which project and folder a type belongs in, and its name, in `dotnet-api-architecture`.
- Resource-oriented URLs, correct verbs and status codes; one endpoint group per resource, with URLs, errors, and pagination shaped the same way across the service.

## Endpoints

- One `static class <Resource>Endpoints` per resource with `public static IEndpointRouteBuilder Map<Resource>Endpoints(this IEndpointRouteBuilder app)`; `Program.cs` only calls these extensions.
- Group with `app.MapGroup("/api/orders")` and put `.RequireAuthorization()`, `.WithTags(...)`, `.AddEndpointFilter<...>()`, and versioning on the group, not on each endpoint.
- Handlers are `private static` methods in the endpoint class (the layout's Private methods region), taking parameters by binding (`[FromRoute]`, `[FromQuery]`, `[FromBody]`, `[AsParameters]` for grouped query models) and services from DI.
- Return `TypedResults`, typed as `Results<Ok<OrderDto>, NotFound, ValidationProblem>`, so status codes and OpenAPI stay honest without attributes. Add `.Produces…()` / `.ProducesValidationProblem()` only for responses a filter adds, which the return type cannot show.
- Describe endpoints with `.WithName(...)`, `.WithSummary(...)`, `.WithDescription(...)`.
- Request and response types are `record`s; never expose EF entities.

## Validation and errors

- **FluentValidation only.** One `AbstractValidator<T>` per request DTO (`Create<Entity>ActionDto`), in the DTO's file; registration and placement per `dotnet-api-architecture` (`references/options-and-validation.md`).
- Validate in a shared `ValidationEndpointFilter<TRequest> : IEndpointFilter` that resolves `IValidator<TRequest>`, runs `ValidateAsync`, and returns `TypedResults.ValidationProblem(result.ToDictionary())` on failure: `.AddEndpointFilter<ValidationEndpointFilter<CreateOrderActionDto>>()`.
- Never DataAnnotations (`[Required]`, `[Range]`, …), `builder.Services.AddValidation()`, or `[ValidatableType]` — not on requests, not on options.
- One `GlobalExceptionHandler : IExceptionHandler` turns every exception into Problem Details (RFC 9457): domain exceptions to their status codes, anything else to a 500 with no exception detail. Never a second handler, and never error responses built in try/catch blocks. Implementation, registration, mappings, and tests: [references/exception-handling.md](references/exception-handling.md).

## Security

- Authenticate with JWT Bearer tokens; integrate Microsoft Entra ID where applicable.
- Role- or policy-based authorization with `RequireAuthorization("policy")` on groups; `AllowAnonymous()` only on explicitly public endpoints.
- HTTPS redirection and HSTS outside development; an explicit named CORS policy listing origins (never `AllowAnyOrigin()` with credentials).
- Rate-limit public and expensive endpoints (`AddRateLimiter` + `.RequireRateLimiting("policy")`) and bound request time (`AddRequestTimeouts` + `.WithRequestTimeout(...)`).

## Versioning and documentation

- Version with `Asp.Versioning.Http`: `NewVersionedApi()` + `.HasApiVersion(1.0)` on the group and a URL segment (`/api/v{version:apiVersion}/...`).
- Document with the built-in `AddOpenApi()` / `MapOpenApi()` (`Microsoft.AspNetCore.OpenApi`) plus the endpoint metadata above; render it with Scalar (`Scalar.AspNetCore`, `MapScalarApiReference()`) in development only. Never `Swashbuckle.AspNetCore`, `AddSwaggerGen`, `UseSwagger`, or `UseSwaggerUI`; migrate any project still on it.

## Testing

- Unit test handlers and services (services on the `csharp-xunit` database ladder, since they query the `DbContext` directly); integration test endpoints, including each Problem Details mapping and the authorization rules.
- Host endpoints with `WebApplicationFactory<Program>` (expose `Program` with `public partial class Program { }`) and substitute external dependencies with NSubstitute (`csharp-xunit`).

## Performance

- Cache deliberately: `HybridCache` for data, output caching (`AddOutputCache()` + `.CacheOutput()`) for read endpoints.
- Paginate, filter, and sort large data sets; enable response compression. Measure before optimizing.

## Deployment

- Containerize with the SDK's built-in support — `dotnet publish --os linux --arch x64 /t:PublishContainer` — instead of a hand-written Dockerfile.
- Ship through CI/CD to Azure Container Apps, App Service, or comparable hosting, with configuration per environment.
- Separate liveness and readiness health checks (`MapHealthChecks("/health/live")`, `MapHealthChecks("/health/ready")` filtered by tag), so a slow dependency takes the instance out of rotation without restarting it.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| [references/exception-handling.md](references/exception-handling.md) | Adding or changing the exception handler, Problem Details registration, or problem `type` URIs; adding an exception type; an error response without a Problem Details body; testing error responses |
