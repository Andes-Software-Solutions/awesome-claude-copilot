---
name: csharp-mcp-server
description: "Use when building or reviewing a Model Context Protocol (MCP) server in C# with the ModelContextProtocol SDK: tools, prompts, resources, stdio and HTTP transports, stderr logging, auth, error handling, security, and testing with McpClient."
---

# C# MCP servers

## Packages and host

- `ModelContextProtocol` (stable; latest from NuGet) for stdio servers on Microsoft.Extensions.Hosting; `ModelContextProtocol.AspNetCore` for HTTP servers; `ModelContextProtocol.Core` for client-only or low-level server code.
- Register with `builder.Services.AddMcpServer()`, then `.WithStdioServerTransport()` or `.WithHttpTransport()`, then `.WithToolsFromAssembly()` (or `.WithTools<T>()`), prompts, and resources.
- stdio servers log to stderr only — `builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace)` — because stdout carries the protocol.
- Code templates, prompts, resources, and the HTTP transport with authentication: [references/patterns.md](references/patterns.md).

## Tools

- `[McpServerToolType]` on the class, `[McpServerTool]` on each method. Prefer instance classes with primary constructors for dependencies; they follow the `csharp-standards` file layout. A `static` tool class is exempt from it. Method parameters can also take DI services, `McpServer`, `ClaimsPrincipal`, and a `CancellationToken`.
- One focused purpose per tool, with a name that states it.
- Describe every tool and parameter with `[Description]` (`System.ComponentModel` — not DataAnnotations). Write it for the calling model: when to use the tool, what it returns, and a follow-up hint ("Use GetComponentDetails(componentName) for more").
- Return strings, Markdown, or JSON-serializable objects; tools can be sync or async (`Task<T>` / `ValueTask<T>`, with `CancellationToken` flowed per `csharp-async`).

## Errors

- Invalid input or a caller-fixable failure: throw `McpException` with a message written for the model — its message reaches the client as a tool error.
- Protocol-level failures: throw `McpProtocolException` with an `McpErrorCode` (for example `InvalidParams`); it becomes a JSON-RPC error.
- Any other exception reaches the client only as a generic "An error occurred invoking '<tool>'" — log the detail server-side.
- Cross-cutting handling (auth, logging, rate limits): request filters (`WithRequestFilters`); custom list/call logic through `McpServerHandlers`, not by replacing tool discovery.

## Security

- Every tool that touches files, networks, or system resources is a security boundary: validate paths and URLs, and expose the least capability that does the job.
- HTTP servers authenticate (JWT Bearer with the MCP auth extensions) and authorize per tool; secrets and credentials follow `csharp-standards`.

## Server-to-client requests

- Set `HttpServerSessionMode` explicitly on HTTP (`Stateless` unless a stateful need is documented); the default has flipped before. Stateless rejects the legacy `SampleAsync` / `AsSamplingChatClient` / `ElicitAsync` calls: get client input through multi round-trip requests (throw `InputRequiredException`; check `server.IsMrtrSupported`). Sampling is deprecated in the 2026-07-28 specification, so a tool that needs a model calls its own `IChatClient`.

## Testing

- xUnit v3 (`csharp-xunit`) driving the server through `McpClient` from the same SDK (or any compliant client); test each tool's success, `McpException`, and authorization paths.
