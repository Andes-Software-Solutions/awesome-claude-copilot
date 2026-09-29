---
name: csharp-mcp-server
description: "Use when building or reviewing a Model Context Protocol (MCP) server in C# with the ModelContextProtocol SDK: tools, prompts, resources, transports, stderr logging, security, and testing with McpClient."
---

# C# MCP Server Development

## Instructions

- Use the **ModelContextProtocol** NuGet package (prerelease) for most projects: `dotnet add package ModelContextProtocol --prerelease`
- Use **ModelContextProtocol.AspNetCore** for HTTP-based MCP servers
- Use **ModelContextProtocol.Core** for minimal dependencies (client-only or low-level server APIs)
- Always configure logging to stderr using `LogToStandardErrorThreshold = LogLevel.Trace` to avoid interfering with stdio transport
- Use the `[McpServerToolType]` attribute on classes containing MCP tools
- Use the `[McpServerTool]` attribute on methods to expose them as tools
- Use the `[Description]` attribute from `System.ComponentModel` to document tools and parameters (the SDK requires it; it is not DataAnnotations)
- Tool classes are `public static` by SDK design and are exempt from the `csharp-standards` file layout; hosts, services, and everything else follow it
- Support dependency injection in tool methods - inject `McpServer`, `HttpClient`, or other services as parameters
- Use `McpServer.AsSamplingChatClient()` to make sampling requests back to the client from within tools
- Expose prompts using `[McpServerPromptType]` on classes and `[McpServerPrompt]` on methods
- For stdio transport, use `WithStdioServerTransport()` when building the server
- Use `WithToolsFromAssembly()` to auto-discover and register all tools from the current assembly
- Tool methods can be synchronous or async (return `Task` or `Task<T>`)
- Always include comprehensive descriptions for tools and parameters to help LLMs understand their purpose
- Use `CancellationToken` parameters in async tools for proper cancellation support
- Return simple types (string, int, etc.) or complex objects that can be serialized to JSON
- For fine-grained control, use `McpServerOptions` with custom handlers like `ListToolsHandler` and `CallToolHandler`
- Use `McpProtocolException` for protocol-level errors with appropriate `McpErrorCode` values
- Test MCP servers with xUnit and the `McpClient` from the same SDK (or any compliant MCP client)
- Structure projects with Microsoft.Extensions.Hosting for proper DI and lifecycle management

## Best Practices

- Keep tool methods focused and single-purpose
- Use meaningful tool names that clearly indicate their function
- Provide detailed descriptions that explain what the tool does, what parameters it expects, and what it returns
- Validate input parameters and throw `McpProtocolException` with `McpErrorCode.InvalidParams` for invalid inputs
- Use structured logging to help with debugging without polluting stdout
- Organize related tools into logical classes with `[McpServerToolType]`
- Consider security implications when exposing tools that access external resources
- Use the built-in DI container to manage service lifetimes and dependencies
- Implement proper error handling and return meaningful error messages
- Test tools individually before integrating with LLMs

- Write `[Description]` text for the model that will call the tool: when to use it, what it returns, and a follow-up hint (for example, "Use GetComponentDetails(componentName) for more information"); format tool output as Markdown.
- Treat every tool that touches files, networks, or system resources as a security boundary: validate paths and URLs, and expose the least capability that does the job.

## Prompts

- `[McpServerPromptType]` on the class, `[McpServerPrompt(Name = "prompt_name")]` (snake_case) on the method; one prompt per class.
- Return `ChatMessage` (not `string`) with `ChatRole.User` for user instructions; describe what the prompt generates with `[Description]`.
- Accept optional parameters with defaults; build multi-section content with `StringBuilder`, including examples and guidelines inline.

## Resources

- `[McpServerResourceType]` on the class; `[McpServerResource]` with `UriTemplate`, `Name`, `Title`, and `MimeType` (usually `text/markdown` or `application/json`).
- URI templates with parameters for dynamic resources (`"myapp://component/{name}"`), static URIs for fixed ones (`"myapp://guides"`); group related resources in one class.
- Return Markdown with navigation hints to related resources; handle missing resources with a helpful error.

## Common Patterns

### Basic Server Setup
```csharp
var builder = Host.CreateApplicationBuilder(args);
builder.Logging.AddConsole(options =>
    options.LogToStandardErrorThreshold = LogLevel.Trace);
builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    .WithToolsFromAssembly();
await builder.Build().RunAsync();
```

### Simple Tool
```csharp
[McpServerToolType]
public static class MyTools
{
    [McpServerTool, Description("Description of what the tool does")]
    public static string ToolName(
        [Description("Parameter description")] string param) =>
        $"Result: {param}";
}
```

### Tool with Dependency Injection
```csharp
[McpServerTool, Description("Fetches data from a URL")]
public static async Task<string> FetchData(
    HttpClient httpClient,
    [Description("The URL to fetch")] string url,
    CancellationToken cancellationToken) =>
    await httpClient.GetStringAsync(url, cancellationToken);
```

### Tool with Sampling
```csharp
[McpServerTool, Description("Analyzes content using the client's LLM")]
public static async Task<string> Analyze(
    McpServer server,
    [Description("Content to analyze")] string content,
    CancellationToken cancellationToken)
{
    ChatMessage[] messages = [new(ChatRole.User, $"Analyze this: {content}")];
    return await server.AsSamplingChatClient()
        .GetResponseAsync(messages, cancellationToken: cancellationToken);
}
```
