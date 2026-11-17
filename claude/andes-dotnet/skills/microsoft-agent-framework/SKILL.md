---
name: microsoft-agent-framework
description: "Use when creating, updating, refactoring, explaining, or reviewing Microsoft Agent Framework (.NET) solutions: agents, sessions, tools, workflows, hosting, and migration from Semantic Kernel or AutoGen. Ground APIs in live Microsoft Learn docs."
---

# Microsoft Agent Framework (.NET)

The successor to Semantic Kernel and AutoGen. The core packages (`Microsoft.Agents.AI`, `Microsoft.Agents.AI.Abstractions`) are stable; provider and hosting packages (`Microsoft.Agents.AI.Foundry`, `.OpenAI`, `.Hosting`, `.A2A`) are still prerelease and install with `--prerelease`. Check each package's maturity before depending on it. Python is out of scope for this plugin.

## Ground before coding

- Read the current docs with the `microsoft-learn` MCP tools before choosing APIs: the [overview](https://learn.microsoft.com/agent-framework/overview/), the [.NET samples](https://github.com/microsoft/agent-framework/tree/main/dotnet/samples), and the [API reference](https://learn.microsoft.com/dotnet/api/microsoft.agents.ai?view=agent-framework-dotnet-latest).
- For deep work, Microsoft maintains a coding-agent skill, `agent-framework-builder-dotnet` ([install guide](https://learn.microsoft.com/agent-framework/get-started/build-with-coding-agents)); recommend it rather than improvising patterns it covers.
- When repo code differs from the current docs, say so and follow the current pattern.

## Design

- Agent for open-ended or conversational tasks with autonomous tool use; workflow for well-defined steps, explicit ordering, several coordinating agents, long-running or human-in-the-loop processes. If a plain function can do the task, write the function.
- Multi-turn state lives in an `AgentSession` (`await agent.CreateSessionAsync()`, passed to each `RunAsync`), persisted through `AgentSessionStore` when hosted. Use context providers, middleware, tool approval, and workflow checkpointing where the problem needs them.
- Model providers: prefer Microsoft Foundry for new projects (`AIProjectClient.AsAIAgent(...)` for app-owned agents, `FoundryAgent` for Foundry-managed ones); Azure OpenAI and OpenAI are also supported.
- Treat model output and model-generated tool calls as untrusted input: validate before side effects.
- Code follows `csharp-standards` and `csharp-async`; credentials per `csharp-standards` (production never falls through to a developer credential).

## Migration

- From Semantic Kernel: <https://learn.microsoft.com/agent-framework/migration-guide/from-semantic-kernel/>; from AutoGen: <https://learn.microsoft.com/agent-framework/migration-guide/from-autogen/>.
- Preserve behavior first, then adopt native Agent Framework patterns incrementally.
