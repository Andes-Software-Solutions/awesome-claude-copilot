# Planner handoffs for VS Code Local

**Date:** 2026-09-29. **Status:** accepted, temporary. Supersedes in part [2026-09-copilot-harness-and-release.md](2026-09-copilot-harness-and-release.md) §1 and [2026-09-copilot-reasoning-effort.md](2026-09-copilot-reasoning-effort.md) D7, which banned `handoffs` on every Copilot agent. The ban still applies to every other agent. `argument-hint` and `vscode/*` tools stay banned on all of them.

## Why

The Copilot agents declare no `target`, so they also load in VS Code. In a VS Code **Local** session, handoff buttons are the quickest way to take an approved plan to its implementer. The conversation moves with the handoff, so the implementer starts with the plan and the discussion behind it.

The key costs nothing on the other surfaces. GitHub documents that the cloud agent ignores `handoffs` and `argument-hint` "to ensure compatibility", and Copilot CLI has no handoff buttons. There, the plan file under `docs/plans/` is still the handoff.

## What shipped

- **Planner buttons.** `andes-planner-expert` declares six handoffs, one for each route in its `<routing>` table:

  | Button | Target agent |
  | --- | --- |
  | Implement: C# Expert | `andes-csharp-expert` |
  | Clean up: C#/.NET Janitor | `andes-csharp-dotnet-janitor` |
  | Implement: Angular Expert | `andes-angular-expert` |
  | Implement: Full-Stack Expert | `andes-full-stack-expert` |
  | Document: SE Technical Writer | `andes-se-technical-writer` |
  | Implement: Default Agent | the built-in `agent` |

- **Button prompts.** Each prompt mirrors that route's next-step prompt and names the `docs/plans/` file as the source of truth. Every button sends its prompt immediately (`send: true`).
- **What was dropped.** The pre-removal "Open in Editor" button is gone, because the plan is already a file.
- **Planner body.** The body now says the buttons exist in VS Code Local sessions. On approval, the planner still restates the **Recommended agent** and **Next step** lines and never invokes the implementer itself.

## Audit rules

- **`agents/vscode-key`.** `handoffs` is allowed only on the agents listed in `copilotHandoffAgents` (`andes-planner-expert`). `argument-hint` stays banned everywhere.
- **`agents/target-ghost`.** This rule also checks handoff targets. A target must be a Copilot agent in this marketplace, or listed in `copilotBuiltinHandoffTargets` (`agent`).
- **No `target-not-invocable` check on handoffs.** The user clicks a handoff; the model never invokes it. `disable-model-invocation` on the target therefore does not matter.

## Exit

Remove the handoffs, the two config entries, and the exemption once VS Code runs agents on the Copilot CLI harness. After that, no surface renders the buttons.

## Not verified

- **Buttons in VS Code.** It is untested that the buttons render in a VS Code Local session, or that bare agent names resolve across plugins there. The planner ships in `andes-core`; the C# and Angular targets ship in `andes-dotnet` and `andes-angular`. If a name fails to resolve, use the fallback in [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md): plugin-qualified IDs.
- **Uninstalled targets.** It is untested how VS Code shows a button whose target agent is not installed.

## References

- GitHub Copilot custom agents configuration (`handoffs`, `target`): <https://docs.github.com/en/copilot/reference/custom-agents-configuration>
- VS Code custom agents, handoffs: <https://code.visualstudio.com/docs/copilot/customization/custom-agents>
