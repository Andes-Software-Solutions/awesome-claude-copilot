# MCP server patterns

## stdio server

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

## Tool class with dependencies

```csharp
[McpServerToolType]
public sealed class CatalogTools(ICatalogService catalog)
{
    private readonly ICatalogService _catalog = catalog;

    [McpServerTool, Description("Finds catalog components by name. Use GetComponentDetails(componentName) for more.")]
    public async Task<string> FindComponents(
        [Description("Part of the component name to search for")] string query,
        CancellationToken cancellationToken)
    {
        var matches = await _catalog.SearchAsync(query, cancellationToken);
        if (matches.Count == 0)
        {
            throw new McpException($"No component matches '{query}'. Try a shorter query.");
        }

        return string.Join('\n', matches.Select(m => $"- **{m.Name}**: {m.Summary}"));
    }
}
```

## HTTP server with authentication

`ModelContextProtocol.AspNetCore`. Stateless sessions are the default; opt into `HttpServerSessionMode.Stateful` only for unsolicited notifications, resource subscriptions, per-client isolation, or server-to-client requests against clients without multi round-trip support.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer(options => { /* Entra ID authority and audience */ })
    .AddMcp(options => { /* protected resource metadata */ });
builder.Services.AddAuthorization();

builder.Services.AddMcpServer()
    .WithHttpTransport(o => o.SessionMode = HttpServerSessionMode.Stateless)
    .AddAuthorizationFilters()
    .WithToolsFromAssembly();

var app = builder.Build();
app.MapMcp().RequireAuthorization();
app.Run();
```

`AddAuthorizationFilters()` is required for `[Authorize]` / `[Authorize(Roles = "...")]` / `[AllowAnonymous]` on tools, prompts, and resources. Read the caller from a `ClaimsPrincipal` tool parameter — it works on every transport — rather than `IHttpContextAccessor`.

## Prompts

- `[McpServerPromptType]` on the class, `[McpServerPrompt(Name = "prompt_name")]` (snake_case) on the method; one prompt per class.
- Return `ChatMessage` (not `string`) with `ChatRole.User` for user instructions; describe what the prompt generates with `[Description]`.
- Accept optional parameters with defaults; build multi-section content with `StringBuilder`, including examples and guidelines inline.

## Resources

- `[McpServerResourceType]` on the class; `[McpServerResource]` with `UriTemplate`, `Name`, `Title`, and `MimeType` (usually `text/markdown` or `application/json`).
- URI templates with parameters for dynamic resources (`"myapp://component/{name}"`), static URIs for fixed ones (`"myapp://guides"`); group related resources in one class.
- Return Markdown with navigation hints to related resources; throw `McpException` with a helpful message for a missing resource.
