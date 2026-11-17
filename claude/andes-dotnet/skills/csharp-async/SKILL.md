---
name: csharp-async
description: "Use when writing or reviewing asynchronous C# code: async/await, Task vs ValueTask, CancellationToken flow, ConfigureAwait, timeouts, bounded concurrency, IAsyncEnumerable, exception handling, background work, and avoiding sync-over-async deadlocks."
---

# C# async

## Signatures

- `Async` suffix; match the synchronous name when one exists (`GetData` → `GetDataAsync`).
- Return `Task<T>` / `Task`. Use `ValueTask<T>` only on hot paths that usually complete synchronously, and await a `ValueTask` exactly once — never store it, await it twice, or call `.Result` on it.
- Accept a `CancellationToken` as the last parameter of every async method that does I/O or long work, and pass it to every async call it makes. On `IAsyncEnumerable<T>` iterators, mark it `[EnumeratorCancellation]`.
- No `async void` outside event handlers.

## Blocking and context

- Async end to end: never `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`, and never mix blocking and async calls on one path.
- `ConfigureAwait(false)` belongs in library code only. ASP.NET Core and worker apps have no synchronization context, so app code omits it.
- Always await a returned task. Return the task directly (no `async`/`await`) only from one-line pass-throughs with no `using`, `try`, or other code after the call.

## Exceptions

- Usage errors (null or invalid arguments) throw synchronously, before the first `await`. Operational errors surface through the returned task: inside `async` methods just throw; non-`async` `Task`-returning methods return `Task.FromException(...)`.
- Catch only to translate an exception or add context, then rethrow. Never catch to build a response — the API's exception handler does that (`aspnet-rest-apis`). No swallowed exceptions.

## Concurrency and time

- Run independent operations together with `Task.WhenAll`.
- Time out with `await task.WaitAsync(timeout, cancellationToken)` or a linked `CancellationTokenSource` with `CancelAfter`, not `Task.WhenAny` against `Task.Delay`.
- Bound concurrency over a collection with `Parallel.ForEachAsync` (`MaxDegreeOfParallelism`), or a `Channel<T>` for producer/consumer work — never an unbounded `Select(...).WhenAll` over a large input.
- Stream sequences with `IAsyncEnumerable<T>` and `await foreach`.
- No fire-and-forget (`_ = DoAsync()`, unawaited `Task.Run`): run background work in a `BackgroundService`, fed by a `Channel<T>` when requests enqueue it.
