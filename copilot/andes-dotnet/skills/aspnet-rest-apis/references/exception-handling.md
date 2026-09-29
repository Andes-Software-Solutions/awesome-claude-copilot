# Exception handling: one global handler

Every exception that escapes an endpoint reaches one `IExceptionHandler`, `GlobalExceptionHandler`. It turns the exception into a Problem Details response (RFC 9457). Placement follows `dotnet-api-architecture`: the handler goes in `Api/ExceptionHandlers/`, and its registration and type URIs go in `Api/Problems/`. Code shape follows `csharp-standards`.

## The mapping

| Exception | Status | Body |
| --- | --- | --- |
| FluentValidation's `ValidationException` | 400 | `HttpValidationProblemDetails` with `errors` grouped by property |
| `BadHttpRequestException` (binding, malformed JSON) | its `StatusCode` | generic title, no detail |
| `NotFoundException` and every exception that derives from it | 404 | the exception message as `detail` |
| `ForbiddenException` and its subclasses | 403 | the exception message as `detail` |
| `ConflictException` and its subclasses (row-version conflicts, business conflicts) | 409 | the exception message as `detail` |
| `OperationCanceledException` after the client disconnected | 499 | none; the client is gone |
| anything else | 500 | generic title, no detail; logged at Error |

- **Feature exceptions derive from a shared type.** `Service/<Feature>/Exceptions/OrderClosedException : ConflictException` maps to 409 without the handler naming it, so the handler never grows. For an input rule that only a service can check, throw a `ValidationException` that carries its failures.
- **The message of a shared-type exception reaches the client.** Write it for the caller. Never put PII, SQL, identifiers of other tenants, or stack text in it. A 5xx body never carries exception detail.
- **Expected outcomes are not exceptions.** A handler that can answer "not found" from a query result returns `TypedResults.NotFound()`. Exceptions carry the cases that surface deep inside a service.

## `Api/ExceptionHandlers/GlobalExceptionHandler.cs`

```csharp
internal sealed partial class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails = problemDetails;
    private readonly ILogger<GlobalExceptionHandler> _logger = logger;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            httpContext.Response.StatusCode = StatusCodes.Status499ClientClosedRequest;
            return true;
        }

        var problem = MapToProblem(exception);
        var status = problem.Status ?? StatusCodes.Status500InternalServerError;
        if (status >= StatusCodes.Status500InternalServerError)
        {
            LogUnhandledException(_logger, exception, httpContext.Request.Method, httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = status;

        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
        });
    }

    #region Private methods

    private static ProblemDetails MapToProblem(Exception exception) => exception switch
    {
        ValidationException validation => new HttpValidationProblemDetails(ToErrors(validation))
        {
            Status = StatusCodes.Status400BadRequest,
            Type = ProblemTypes.BadRequest,
            Title = "One or more validation errors occurred.",
        },
        BadHttpRequestException badRequest => Problem(badRequest.StatusCode, ProblemTypes.BadRequest, "The request could not be read.", null),
        NotFoundException => Problem(StatusCodes.Status404NotFound, ProblemTypes.NotFound, "The resource was not found.", exception.Message),
        ForbiddenException => Problem(StatusCodes.Status403Forbidden, ProblemTypes.Forbidden, "Access to the resource is forbidden.", exception.Message),
        ConflictException => Problem(StatusCodes.Status409Conflict, ProblemTypes.Conflict, "The request conflicts with the current state of the resource.", exception.Message),
        _ => Problem(StatusCodes.Status500InternalServerError, ProblemTypes.Unexpected, "An unexpected error occurred.", null),
    };

    private static ProblemDetails Problem(int status, string type, string title, string? detail) =>
        new() { Status = status, Type = type, Title = title, Detail = detail };

    private static Dictionary<string, string[]> ToErrors(ValidationException exception) =>
        exception.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

    #endregion

    #region Logging

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception for {Method} {Path}")]
    private static partial void LogUnhandledException(ILogger logger, Exception exception, string method, PathString path);

    #endregion
}
```

- **It logs 5xx itself.** Since .NET 10, the exception handler middleware writes no log, `HandledException` event, or `error.type` metric tag for an exception that an `IExceptionHandler` handled ([breaking change](https://learn.microsoft.com/aspnet/core/breaking-changes/10/exception-handler-diagnostics-suppressed)). 4xx outcomes are expected and are not logged as errors.
- **`ValidationException` is FluentValidation's** (`using FluentValidation;`). Requests are still validated by the endpoint filter, which returns `TypedResults.ValidationProblem` before any handler runs. This arm catches validation that a service throws.
- **It sets the status before writing.** A handler that returns `true` without a status leaves the response at 404, and the middleware logs that as an error.
- **Grant the unit test project access** with `<InternalsVisibleTo Include="<Root>.Unit.Test" />` in the Api csproj. The handler is `internal`.

## `Api/Problems/Constants/ProblemTypes.cs`

```csharp
internal static class ProblemTypes
{
    public const string BadRequest = "https://tools.ietf.org/html/rfc9110#section-15.5.1";
    public const string Forbidden = "https://tools.ietf.org/html/rfc9110#section-15.5.4";
    public const string NotFound = "https://tools.ietf.org/html/rfc9110#section-15.5.5";
    public const string Conflict = "https://tools.ietf.org/html/rfc9110#section-15.5.10";
    public const string Unexpected = "https://tools.ietf.org/html/rfc9110#section-15.6.1";
}
```

The `type` URIs are a wire contract. Clients branch on them, so change them only with a version bump.

## `Api/Problems/ProblemDetailsRegistration.cs`

```csharp
internal static class ProblemDetailsRegistration
{
    #region Public static methods

    public static IServiceCollection AddContosoProblemDetails(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        {
            context.ProblemDetails.Instance ??= $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";
            context.ProblemDetails.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);
        });
        services.AddExceptionHandler<GlobalExceptionHandler>();

        return services;
    }

    #endregion
}
```

`CustomizeProblemDetails` runs for every Problem Details response the app writes: the handler's own, `UseStatusCodePages`, and `TypedResults.ValidationProblem`. `instance` and `traceId` are therefore present on all of them.

## `Program.cs` (excerpt)

```csharp
builder.Services.AddContosoProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
```

`UseExceptionHandler()` comes first so it wraps the whole pipeline. With no arguments it needs `AddProblemDetails()`, which the registration supplies, and it runs the same way in every environment. `UseStatusCodePages()` gives a body to bare status codes such as `TypedResults.NotFound()` or a 405.

## Tests

- **Unit** (`tests/<Root>.Unit.Test/Api/ExceptionHandlers/GlobalExceptionHandlerTests.cs`): add one `[Theory]` row per mapping. Use a `DefaultHttpContext`, a substituted `IProblemDetailsService`, and `NullLogger<GlobalExceptionHandler>.Instance`. Assert the status code and the `ProblemDetails` the service received.

  ```csharp
  [Fact]
  public async Task TryHandleAsync_NotFoundException_Writes404Problem()
  {
      var problemDetails = Substitute.For<IProblemDetailsService>();
      problemDetails.TryWriteAsync(Arg.Any<ProblemDetailsContext>()).Returns(ValueTask.FromResult(true));
      var handler = new GlobalExceptionHandler(problemDetails, NullLogger<GlobalExceptionHandler>.Instance);
      var context = new DefaultHttpContext();

      var handled = await handler.TryHandleAsync(context, new NotFoundException("Order was not found."), TestContext.Current.CancellationToken);

      Assert.True(handled);
      Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
      await problemDetails.Received(1).TryWriteAsync(Arg.Is<ProblemDetailsContext>(c => c.ProblemDetails.Type == ProblemTypes.NotFound));
  }
  ```

- **Integration**: through `WebApplicationFactory<Program>`, assert the status, the `application/problem+json` content type, `type`, `traceId`, and, for a 500, that `detail` is absent.

## Never

- No `IExceptionHandler` besides `GlobalExceptionHandler`; a new exception derives from a shared type instead.
- No try/catch in an endpoint or filter that builds an error response. Catch only to translate a store or provider fault into a shared-type exception, in the service.
- No exception message, stack trace, or inner exception in a 5xx body, in any environment.
- No `UseDeveloperExceptionPage()` next to `UseExceptionHandler()`: it replaces the Problem Details contract in development.
