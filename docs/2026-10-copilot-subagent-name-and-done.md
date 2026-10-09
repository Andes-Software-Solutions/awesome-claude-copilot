# Copilot subagent `name` and the definition of done

**Date:** 2026-10-09. **Status:** accepted. Amends [2026-09-planner-handoffs.md](2026-09-planner-handoffs.md) (handoff prompts now carry the definition of done) and the `AGENTS.md` block (`v1.12.1`).

## Why

- **Subagent calls failed on Copilot CLI 1.0.90.** Its `task` tool takes `agent_type`, `name`, `description`, `prompt`, and an optional `mode`, and `name` is required. A recorded session shows `claude-sonnet-5.5` calling `andes-dotnet:andes-csharp-code-reviewer` without `name` and getting `"name": Required`. The retry with `name: andes-review` succeeded. No agent prompt mentioned the argument.
- **Implementers could stop before review and docs finished.** The review loop said when to call the writer but never defined done. The planner's routing told the plan to leave review and docs to the implementer. Its next-step prompts and handoffs said nothing about either, so the default Copilot agent got neither.
- **The janitor skipped the writer.** For routine cleanups it wrote its own changelog line, even though `andes-se-technical-writer` owns `CHANGELOG.md`.

## Decisions

### D1. Name the argument where subagents are called

- The `## Review loop` intro says reviewers and the writer run as subagents. On Copilot CLI, the `task` call must pass `name`, a short kebab-case label such as `csharp-review-1`.
- The intro lives in the block, so it reaches the default Copilot agent through `AGENTS.md` and the four implementers through the verbatim copy (`memory/loop-drift`).
- The planner gets the same note where it invokes `andes-prd-generator`. The planner is not one of the implementers that carry the loop copy.
- Claude Code's subagent tool has no `name` argument, and the note is scoped to Copilot CLI, so Claude ignores it.

### D2. Loop step 4 defines done

- Step 4 now ends with the rule: a change is done only after a passing verdict within two rounds and the writer's return, or the caller's own documentation step. The final summary gives the verdict and the round count.
- It extends step 4 instead of adding a step 5 because the always-on block has a 700-word budget (`memory/budget`).
- `andes-csharp-expert` and `andes-angular-expert` end their workflow with a **Finish** step that points at it.

### D3. The planner states done in every recommendation

- `<routing>` defines one **done clause**: the matching reviewer, two rounds maximum, then `andes-se-technical-writer`. Terraform runs `terraform fmt -check` and `terraform validate` instead of a reviewer.
- Every next-step prompt ends with that clause. The clause is defined once rather than repeated per agent to keep the body under the 12,000-character budget (`agents/body-budget`).
- The VS Code handoff prompts spell the clause out, because a button sends its prompt as written.
- The default Copilot agent gets its own next-step prompt, and the plan template gains a **Done when** line.

### D4. The janitor documents through the writer

- The janitor runs loop steps 1–3 after each batch.
- After the last batch's passing verdict, it invokes the writer once with every batch listed. The writer adds the one-line `### Changed` or `### Removed` entry for routine cleanups.

### D5. The block marker carries the plugin version

- `<!-- andes:begin vX.Y.Z -->` now names the plugin release that ships the block (`v1.12.1`), replacing the separate block version (last `v1.5.0`). A consumer can see which `andes-init` wrote its block.
- `memory/block-version` fails when the marker differs from the `andes-core` manifest version. Every lockstep bump therefore updates the template, its mirror, and the root `AGENTS.md`, and the next `andes-init` run refreshes the block in consumer repos.

## Consequences

- One more writer call per janitor run, on Haiku 4.5.
- Consumers rerun `andes-init` to get block `v1.12.1`. Until then, the default agent's `AGENTS.md` lacks the `name` note and the definition of done, though the Copilot implementers already carry them.
