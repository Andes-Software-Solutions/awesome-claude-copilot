# Triggers and bindings (isolated worker)

## Triggers

- **HttpTrigger**: `AuthorizationLevel.Function` or higher (or Entra ID) in production; `Anonymous` only for public endpoints with explicit justification. With ASP.NET Core integration (`ConfigureFunctionsWebApplication`), handlers take `HttpRequest` and return `IResult` / `IActionResult` — the Functions HTTP result types, not MVC controllers, so they are allowed.
- **TimerTrigger**: NCRONTAB schedules (`"0 */5 * * * *"`). Never `RunOnStartup = true` in production: it fires on every cold start and scale-out. Use deployment slots or a feature flag to force a run.
- **QueueTrigger / ServiceBusTrigger**: redelivery is the retry — tune the Storage queue's `maxDequeueCount` in `host.json`, and the Service Bus entity's `MaxDeliveryCount` on the queue or subscription itself; poison messages land in `<queue>-poison` or the dead-letter queue. Bind `ServiceBusReceivedMessage` with `ServiceBusMessageActions` when you need explicit complete, abandon, or dead-letter; set `maxConcurrentCalls` in `host.json`.
- **BlobTrigger**: use the Event Grid source — `[BlobTrigger("container/{name}", Source = BlobTriggerSource.EventGrid)]`, Storage extension 5.x (`Microsoft.Azure.Functions.Worker.Extensions.Storage.Blobs`), plus an event subscription on the container. It has lower latency than polling and is the only blob trigger Flex Consumption supports.
- **EventHubTrigger**: batch mode (`IsBatched = true`, the default) with `EventData[]`; checkpoints are written after the invocation (and any retry policy) completes, so make processing idempotent.
- **CosmosDBTrigger**: the change feed trigger with a dedicated lease container (`LeaseContainerName`), separate from data containers.

## Bindings

- Use an input binding where it covers the read; inject the SDK client for anything it doesn't (complex queries, batching, transactions). Pick one pattern per resource — don't mix binding I/O and an SDK client for the same resource.
- Several outputs: return a custom type whose properties carry output attributes (`[QueueOutput]`, `[BlobOutput]`, `[HttpResult]`).
- Blobs: `[BlobInput]` / `[BlobOutput]`; bind `Stream` rather than `byte[]` for large blobs.
- Cosmos DB: `[CosmosDBInput]` for point reads and simple queries; inject `CosmosClient` for complex queries.
- Service Bus: `[ServiceBusOutput]` for single sends; inject `ServiceBusSender` for batches or scheduled messages.
- Connections are identity-based app settings (`<Name>__fullyQualifiedNamespace`, `<Name>__serviceUri`), never keys.
