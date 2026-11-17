---
name: azure-functions-csharp
description: "Use when building or reviewing Azure Functions in C# (.NET isolated worker): triggers and bindings, host.json and local.settings.json, DI, retries, OpenTelemetry, Flex Consumption hosting, security, testing, and migrating off the retired in-process model."
---

# Azure Functions in C#

## Model and host

- **Isolated worker model only**, on .NET 10 (the current LTS). The in-process model's support ended on 10 November 2026: flag any `FunctionsStartup` / `IWebJobsStartup` / `Microsoft.NET.Sdk.Functions` project and migrate it per [Migrate .NET apps to the isolated worker model](https://learn.microsoft.com/azure/azure-functions/migrate-dotnet-to-isolated-model).
- Host setup in `Program.cs` with `FunctionsApplication.CreateBuilder(args)`; call `builder.ConfigureFunctionsWebApplication()` for ASP.NET Core HTTP integration.
- Project SDK `<Project Sdk="Azure.Functions.Sdk/1.0.x">` (it replaces the `Microsoft.Azure.Functions.Worker.Sdk` package and sets `OutputType` / `AzureFunctionsVersion`; never reference both, AZFW0105), plus an explicit `Microsoft.Azure.Functions.Worker` and the `Microsoft.Azure.Functions.Worker.Extensions.*` packages.
- `[Function("Name")]` methods stay thin: bind the input, call an injected service, return. Business logic lives in DI-registered services (`csharp-standards` layout, `[LoggerMessage]` logging, `csharp-async` rules); group functions into classes by domain concern, not by trigger type.
- Inject `ILogger<T>` through the class's primary constructor, not as a function parameter.

## Configuration and identity

- `local.settings.json` for local development only (never committed with secrets); App Settings or Azure App Configuration when deployed, read through `IOptions<T>`.
- Secrets through Key Vault references (`@Microsoft.KeyVault(SecretUri=...)`); identity-based connections (`<Connection>__serviceUri` / `__fullyQualifiedNamespace`) instead of keys or connection strings. Credential choice per `csharp-standards`.
- Register Azure SDK clients once with `builder.Services.AddAzureClients(...)` (`Microsoft.Extensions.Azure`) and `HttpClient` through `IHttpClientFactory`; no `static` state in function classes.

## Triggers and bindings

Trigger-specific rules (HTTP authorization levels, Timer, Queue and Service Bus settlement, Event Grid blob triggers, Event Hubs batching, Cosmos DB change feed) and binding choices: [references/triggers-and-bindings.md](references/triggers-and-bindings.md).

## Errors and retries

- Retry policies are per function: `[FixedDelayRetry]` or `[ExponentialBackoffRetry]`, supported only on Timer, Event Hubs, and Kafka triggers in the isolated worker (verify per extension version). Queue and Service Bus retry through redelivery — the queue's `maxDequeueCount` or the entity's `MaxDeliveryCount` — then dead-letter.
- Transient faults on outbound calls: `Microsoft.Extensions.Http.Resilience` or Polly v8 `ResiliencePipeline`. Never hand-rolled retries with `Thread.Sleep` / `Task.Delay`.
- Catch only to add context (correlation ID, message ID) and rethrow, so the runtime retries or dead-letters; never swallow.
- HTTP functions return errors as Problem Details like the APIs do (`aspnet-rest-apis`): `TypedResults.ValidationProblem` / `TypedResults.Problem` with ASP.NET Core integration, never `BadRequestObjectResult` bodies.

## Observability

- OpenTelemetry with the Azure Monitor exporter: `Microsoft.Azure.Functions.Worker.OpenTelemetry` + `Azure.Monitor.OpenTelemetry.Exporter`, `builder.Services.AddOpenTelemetry().UseFunctionsWorkerDefaults().UseAzureMonitorExporter()`, and `"telemetryMode": "OpenTelemetry"` in `host.json`. The classic Application Insights SDK (`AddApplicationInsightsTelemetryWorkerService`, `TelemetryClient`) is legacy — migrate it.
- Host and worker log levels are configured separately: `host.json` `logging` affects only the host; set worker levels in `appsettings.json` or code.
- Trace across functions with `ActivitySource`.

## Hosting and performance

- **Flex Consumption** for event-driven and HTTP workloads (Linux Consumption does not run .NET 10); Premium or Dedicated only for needs Flex cannot meet. Flex deploys from its own storage container — never set `WEBSITE_RUN_FROM_PACKAGE` there; on other plans, run from a package.
- Keep startup cheap: no expensive work in constructors or `Program.cs` beyond registration.
- Long or CPU-heavy work goes to Durable Functions or a queue-triggered function, never a background `Task` that outlives the invocation.
- Process batches (`EventData[]`, `ServiceBusReceivedMessage[]`) in one invocation where the trigger supports it.

## Security

- Validate HTTP inputs with FluentValidation (`IValidator<T>` from DI); never DataAnnotations.
- `AuthorizationLevel.Function` or Entra ID authentication in production; `Anonymous` only for public endpoints with a stated reason. Put Azure API Management in front of public APIs for auth, rate limiting, and routing.
- Restrict inbound access (access restrictions, private endpoints) for internal functions.

## Testing

- Unit-test the services with xUnit v3 + NSubstitute (`csharp-xunit`); don't test trigger plumbing.
- Integration-test against Azurite (Storage) or real resources, running the app with Azure Functions Core Tools (`func start`).
