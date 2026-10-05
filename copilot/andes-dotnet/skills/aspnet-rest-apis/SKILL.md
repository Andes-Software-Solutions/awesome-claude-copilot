---
name: aspnet-rest-apis
description: "Use when building or reviewing ASP.NET Core Web APIs (Minimal APIs only, never controllers): endpoint groups, TypedResults, FluentValidation endpoint filters, Problem Details, Entra ID/JWT auth, versioning, OpenAPI, caching, and container deployment."
---

# ASP.NET Core REST API Development

## Instructions

- Build REST APIs on ASP.NET Core 10 with **Minimal APIs only**. Never add MVC controllers, `[ApiController]`, `AddControllers()`, or `MapControllers()`; scaffold with `dotnet new webapi` (its default is Minimal APIs — never pass `--use-controllers`).
- Apply best practices for API design, testing, documentation, and deployment.
- Note the reasoning behind non-obvious design decisions; no tutorial-style explanations unless asked.
- General C# standards (file layout, primary constructors, `var`, logging, nullability) live in the `csharp-standards` skill; solution and folder layout (which project and folder a type belongs in, and its name) in `dotnet-api-architecture`.

## API Design

- Design resource-oriented URLs with appropriate HTTP verbs, status codes, content negotiation, and consistent response formatting.
- One endpoint group per resource; keep the shape of URLs, errors, and pagination consistent across the service.

## Endpoints

- One `static class <Resource>Endpoints` per resource with `public static IEndpointRouteBuilder Map<Resource>Endpoints(this IEndpointRouteBuilder app)`; `Program.cs` only calls these extensions.
- Group with `app.MapGroup("/api/orders")` and put `.RequireAuthorization()`, `.WithTags(...)`, `.AddEndpointFilter<...>()`, and versioning on the group, not on each endpoint.
- Handlers are `private static` methods in the endpoint class (the layout's Private methods region), taking parameters by binding (`[FromRoute]`, `[FromQuery]`, `[FromBody]`, `[AsParameters]` for grouped query models) and services from DI.
- Return `TypedResults`, typed as `Results<Ok<OrderDto>, NotFound, ValidationProblem>`, so status codes and OpenAPI stay honest without attributes.
- Describe endpoints with `.WithName(...)`, `.WithSummary(...)`, `.WithDescription(...)`, and `.Produces...` / `.ProducesValidationProblem()`.
- Request and response types are `record`s; never expose EF entities.

## Validation and Error Handling

- **FluentValidation only.** One `AbstractValidator<TRequest>` per request type; register with `services.AddValidatorsFromAssemblyContaining<Program>()`.
- Validate in a shared endpoint filter (`ValidationFilter<TRequest> : IEndpointFilter`) that resolves `IValidator<TRequest>`, runs `ValidateAsync`, and returns `TypedResults.ValidationProblem(result.ToDictionary())` on failure; add it to the group or endpoint with `.AddEndpointFilter<ValidationFilter<CreateOrderRequest>>()`.
- Length, precision, and range rules read the entity's `Common/Limits/<Entity>Limits` constants — the ones its EF configuration maps — never a literal (`ef-core`).
- Never use DataAnnotations (`[Required]`, `[Range]`, …), `builder.Services.AddValidation()`, or `[ValidatableType]` — not on requests, not on options.
- Handle every exception in one `GlobalExceptionHandler : IExceptionHandler`, registered with `AddProblemDetails()` and run by `UseExceptionHandler()` + `UseStatusCodePages()` at the top of the pipeline. It maps `NotFoundException` / `ForbiddenException` / `ConflictException` (and the feature exceptions derived from them), FluentValidation's `ValidationException`, and `BadHttpRequestException` to their status codes, and anything else to a 500 with no exception detail. It logs 5xx itself because .NET 10 no longer does. Every error is Problem Details (RFC 9457). Never add a second handler or build error responses in try/catch blocks. The full implementation, registration, and tests are in `references/exception-handling.md`.

## Authentication and Authorization

- Authenticate with JWT Bearer tokens; integrate Microsoft Entra ID where applicable.
- Apply role-based or policy-based authorization with `RequireAuthorization("policy")` on groups; `AllowAnonymous()` only on explicitly public endpoints.

## Versioning and Documentation

- Version with `Asp.Versioning.Http`: `NewVersionedApi()` + `.HasApiVersion(1.0)` on the group and a URL segment (`/api/v{version:apiVersion}/...`).
- Document with the built-in `AddOpenApi()` / `MapOpenApi()` (`Microsoft.AspNetCore.OpenApi`) plus the endpoint metadata above; render it with Scalar (`Scalar.AspNetCore`, `MapScalarApiReference()`) in development only. Never `Swashbuckle.AspNetCore`, `AddSwaggerGen`, `UseSwagger`, or `UseSwaggerUI`; migrate any project still on it.

## Testing

- Unit test handlers and services (services on the `csharp-xunit` database ladder, since they query the `DbContext` directly); integration test endpoints, including each Problem Details mapping.
- Substitute external dependencies with NSubstitute and host endpoints with `WebApplicationFactory<Program>` (see the `csharp-xunit` skill; expose `Program` with `public partial class Program { }`); test authentication and authorization logic.

## Performance

- Cache appropriately: in-memory, distributed (`HybridCache`), or output caching (`AddOutputCache()` + `.CacheOutput()` on read endpoints).
- Stay async end to end; paginate, filter, and sort large data sets; enable response compression.
- Measure and benchmark before optimizing.

## Deployment and DevOps

- Containerize with .NET's built-in container support (`dotnet publish --os linux --arch x64 -p:PublishProfile=DefaultContainer`) instead of a manual Dockerfile.
- Ship through CI/CD to Azure App Service, Azure Container Apps, or comparable hosting.
- Implement health checks (`MapHealthChecks`) and readiness probes; keep configuration environment-specific per stage.

## References

Read these on demand — they are not loaded until you need them.

| Read this | When |
| --- | --- |
| `references/exception-handling.md` | Adding or changing the exception handler, Problem Details registration, or problem `type` URIs; adding an exception type; an error response without a Problem Details body; testing error responses |
