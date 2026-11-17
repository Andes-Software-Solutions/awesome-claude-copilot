# Standards revision: one owner per rule, corrected rules, detail in references

**Date:** 2026-11-16. **Status:** accepted. Applies to the C#, .NET data, and Angular skills and to the reviewer and expert agents. Ships in 1.16.1.

## Why

A re-read of the C#, .NET data, and Angular skills against current documentation found two kinds of problem. Some rules were wrong or stale: a registration rule that pointed to a place a scan cannot find, a deactivation interceptor that overwrote whole rows, a "static by SDK design" rule that the SDK does not impose. And the same rule lived in several skills, so a fix in one left the others contradicting it.

The fix has two parts. Each rule gets one owner skill, and other skills link to it. Long detail moves into `references/` files, which load on demand, so the always-loaded `SKILL.md` bodies shrink.

## What changed

### Ownership

| Rule | Owner |
| --- | --- |
| Async | `csharp-async` |
| Errors | `csharp-standards/references/exception-handling.md` |
| EF Core | `ef-core` |
| Testing | `csharp-xunit` |
| Logging and Azure credentials | `csharp-standards` (`DefaultAzureCredential` for local development only, `ManagedIdentityCredential` in Azure) |
| XML docs on public APIs | `csharp-docs` (now "must") |
| State | `ngrx-signal-store` |
| Routes and the `angular-cli` MCP workflow | `angular-standards` |
| Naming | `angular-ui-architecture` |

The C# and Angular reviewers, on both harnesses, defer their checklists to the loaded skills and keep severity hints. The Copilot `andes-angular-expert` says "OnPush-compatible" and uses Context7 for third-party libraries. `andes-full-stack-expert` names the wire-DTO locations and loads `angular-standards` for contract design.

### Corrected rules

| Area | Correction |
| --- | --- |
| `aspnet-rest-apis` | Validator registration points to `dotnet-api-architecture`, because a scan rooted at `Program` found nothing in `Dto`. Names use `ValidationEndpointFilter` and `CreateOrderActionDto`. |
| `csharp-xunit` | Uses the .NET 10 SDK Microsoft Testing Platform opt-in (`test.runner` in `global.json`), the `xunit.v3` variants (`mtp-v2` from xUnit 4.0, `mtp-off` for VSTest), `--filter-method`, and `HttpValidationProblemDetails`. |
| `csharp-mcp-server` | Instance tool classes with primary constructors are preferred; the "static by SDK design" rule was false. The package is stable, `HttpServerSessionMode` is explicit, and error pass-through rules are added. Sampling is deprecated in the 2026-07-28 MCP spec, so the guidance is MRTR or your own `IChatClient`. |
| `azure-functions-csharp` | .NET 10 isolated worker only (in-process support ended 10 Nov 2026), the `Azure.Functions.Sdk` project SDK, `FunctionsApplication.CreateBuilder`, `AddAzureClients` from `Microsoft.Extensions.Azure`. Retry attributes apply only to Timer, Event Hubs, and Kafka triggers in the isolated worker. Event Grid blob triggers use `BlobTriggerSource.EventGrid`. OpenTelemetry with `telemetryMode` replaces the legacy Application Insights SDK, and Flex Consumption is covered. |
| `microsoft-agent-framework` | Core packages are stable (v1.13.0), providers are prerelease, and the API is `AgentSession` / `CreateSessionAsync` on Microsoft Foundry. |
| `csharp-async` | Rewritten: sync usage errors, catch only to translate, cancellation flow, `ConfigureAwait` in libraries only, `WaitAsync`, `ValueTask` consumed once, `EnumeratorCancellation`, bounded concurrency, no fire-and-forget. |
| Deactivation interceptor | Sets the entry to `Unchanged` and marks only `DateDeactivated` modified. Before, `Modified` overwrote the whole row when you removed a stub entity. |
| Audit interceptor | Keeps `DateCreated` unmodified on update. |
| SQLite test fixture | Must remap `Version` (SQLite has no database-generated concurrency tokens) or use another rung of the database ladder. |
| Test migrations | `MigrateAsync` on Testcontainers or a dedicated database; `EnsureCreated` on SQLite. |
| `ef-core` | Guid or int keys only (natural keys become a unique index), value objects as complex types rather than owned types, keyset pagination, unique indexes on deactivatable tables filtered to active rows, `UseSeeding` only for test fixtures and local development. |
| `blazor-wasm` | The opt-in fingerprinting guidance is completed. |
| Angular testing | `whenStable` only for new or rewritten specs; existing `detectChanges` suites stay, per angular.dev. |
| Angular forms and HTTP | Reactive Forms on zoneless need `toSignal` or `markForCheck`. Cookie-auth apps call `provideHttpClient()` for XSRF. |
| Angular services and zone | `@Service({ factory })` is root-only, and the `@angular/core:service` migration needs v22.1 after the `inject` migration. `NgZone.onUnstable` is banned; `run` and `runOutsideAngular` stay. SSR waits use `PendingTasks`. |
| Naming and lint | The vendored `naming-conventions.md` is outranked by the Andes naming rules. The NgRx ESLint config uses `configs.signals` plus `signalsTypeChecked`. |

New rules added alongside: `csharp-standards` gains sealed by default, `TimeProvider`, `TreatWarningsAsErrors`, `AnalysisLevel`, Central Package Management, and `ThrowIfNullOrWhiteSpace`. `aspnet-rest-apis` gains HTTPS and HSTS, CORS, rate limiting, request timeouts, and liveness and readiness probes. `csharp-xunit` gains `FakeTimeProvider` and `FakeLogger`.

### Moves into `references/`

| New file | Holds |
| --- | --- |
| `azure-functions-csharp/references/triggers-and-bindings.md` | Trigger and binding detail |
| `csharp-mcp-server/references/patterns.md` | MCP server patterns |
| `csharp-standards/references/editorconfig.md` | `.editorconfig` content |
| `csharp-xunit/references/database-ladder.md` | The test-database ladder |
| `ef-core-base-entities/references/keys.md`, `interceptors.md`, `testing.md` | Key, interceptor, and test detail |
| `angular-ui-architecture/references/styling.md` | Styling rules |

`microsoft-agent-framework/references/dotnet.md` is folded into its `SKILL.md` and deleted.

## Findings dropped after re-verification

| Finding | Outcome |
| --- | --- |
| `Microsoft.Azure.Functions.Worker.Testing` | Could not confirm the package exists, so the reference is removed. |
| "Linux Consumption retires 30 Sep 2028" | Unconfirmed, so the skill does not state it. |
| Fixing the sampling example | Sampling is deprecated, so the example is removed instead of fixed. |
| Cosmos DB in the isolated retry-attribute list | Removed; only Timer, Event Hubs, and Kafka remain. |

## Sizes

| File | Before | After |
| --- | --- | --- |
| C# core `SKILL.md` bodies (total) | 48.5k | about 36.5k |
| `dotnet-api-architecture` | 20.1k | 17.5k |
| `ef-core-base-entities` | 14.2k | 9.2k |
| `blazor-wasm` | 11.3k | 10.7k |
| `ef-core` | 7.7k | 8.3k (new current-version rules) |
| `angular-ui-architecture` | 14.8k | 12.9k |
| `ngrx-signal-store` `SKILL.md` | 10.1k | 9.3k |
| `angular-standards` | 8.2k | 8.6k (gaps filled) |
| Reviewer agents | | 0.3k to 0.8k smaller each |

Sizes are bytes. The moved detail loads only when a task needs it.

## Not verified

- **SQLite insert failure on an unmapped row version.** This was reasoned from how SQLite handles concurrency tokens, not run. To check it, insert an entity through the fixture without the `Version` remap.
- **XSRF rule.** Confirmed from the Angular source and the vendored docs, not from the angular.dev security page.
- **Token use.** No measurement exists of the always-loaded or per-task token change. To produce one, load each skill before and after and compare the totals from `/usage`.
