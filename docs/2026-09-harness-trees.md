# ADR-003: One Plugin Tree per Harness

**Status**: Accepted — verified by the audit, `claude plugin validate --strict`, the hook tests, and Claude Code loading the Claude tree; installed-client checks pending ([checklist](#client-checks))
**Date**: 2026-09-29
**Deciders**: Rodrigo Rojas
**Amends**: [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) §1 (the layout) and [2026-09-notification-and-link-hooks.md](2026-09-notification-and-link-hooks.md) D2 (the hook folder names). It carries out the fallback ADR-001 kept for this case.

The manifests, `AGENTS.md`, and `scripts/repo-audit.mjs` are the source of truth. If a value here disagrees with a file, trust the file.

## Context

ADR-001 served both harnesses from one folder per plugin. The folder held two manifests, two MCP files, two agent folders, and two hook files. Isolation depended on every Copilot client choosing the Agent Plugins manifest over the Claude one.

A harness in VS Code then loaded the wrong agents. The clients on the affected machine were current: VS Code 1.139.1, Copilot CLI 1.0.89, and Claude Code 2.1.284. Old client versions were not the cause.

**What was observed on that machine:**

- **VS Code copies whole plugin folders.** `%APPDATA%\Code\agentPlugins\` held full copies of `andes-core` and `andes-dotnet`. Each copy contained both manifests, the Claude agents, and the Copilot agents.
- **VS Code runs several agent hosts.** The same folder held synced bundles for a Claude host and a Copilot CLI host.
- **One plugin arrived twice.** One copy came from VS Code's own clone of the marketplace, the other from Copilot CLI's install folder.
- **VS Code scans Claude Code's enabled plugins.** Its agent host log names them in `claudeNativePluginScan` entries.

**Conclusion, inferred from those observations:** VS Code offers one plugin folder to more than one harness, and each harness reads the manifest it understands. A folder that carries both formats cannot be isolated by any precedence rule.

**Loading rules that constrain the layout:**

| Harness | Reads | Never reads |
| --- | --- | --- |
| Claude Code (CLI and VS Code extension) | `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, and the default locations `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json` | A root `plugin.json`, `mcp.json`, `com.github.copilot/` |
| Copilot CLI and VS Code | The first marketplace file found, in this order: `marketplace.json`, `.plugin/marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json` | Nothing. Without an Agent Plugins manifest they fall back to the Claude format. |

Neither harness loads a file outside a plugin root. Claude Code does not copy such files into its cache, and Agent Plugins 1.0 §4.1 rejects them.

## Decision

### 1. Two trees

```text
.claude-plugin/marketplace.json      # Claude Code only  -> ./claude/andes-<name>
.github/plugin/marketplace.json      # Copilot only      -> ./copilot/andes-<name>
claude/andes-<name>/
├── .claude-plugin/plugin.json       # metadata and dependencies only
├── agents/*.md
├── hooks/hooks.json                 # andes-core
├── skills/                          # edited here
├── scripts/                         # edited here (andes-core)
└── .mcp.json
copilot/andes-<name>/
├── plugin.json                      # Agent Plugins 1.0
├── mcp.json
├── skills/                          # mirror
├── scripts/                         # mirror
└── com.github.copilot/
    ├── agents/*.agent.md
    └── hooks/hooks.json             # andes-core
```

### 2. Two marketplaces with one name

Copilot CLI and VS Code reach `.github/plugin/marketplace.json` before the Claude file. Claude Code reads only its own. Both files use the name `andes` and list the same plugins, because Copilot clients also read `enabledPlugins` from the `.claude/settings.json` that `andes-init` writes. `andes-core@andes` must resolve on either harness.

### 3. The Claude tree uses Claude Code's default folders

`claude-agents/` becomes `agents/` and `claude-hooks/` becomes `hooks/`. The manifest drops its `agents` list and its `hooks` key. The old names only stopped cross-loading inside a shared folder, and they never protected against a client that parses the Claude manifest.

Declaring the default hooks file in the manifest as well would register each hook twice, because Claude Code merges the two.

### 4. Shared content is mirrored

`skills/` and `scripts/` exist in both trees and must match. `claude/` is the editing tree.

```shell
node scripts/sync-shared.mjs              # copy claude/ to copilot/
node scripts/sync-shared.mjs --check      # report differences, write nothing
node scripts/sync-shared.mjs --from=copilot --plugin=andes-core
```

The helper copies byte for byte, because `angular-developer` is hash-pinned. It refuses to overwrite a destination file that carries uncommitted edits unless you pass `--force`.

Hook scripts stay aware of both harnesses. `andes-init` run from Claude Code installs `check-links.mjs` for the Copilot cloud agent, so one script must answer in either protocol.

### 5. Agents belong to their tree

Agents are never mirrored. Each tree holds its own files in its own format. The audit keeps the parity rules for the six roles both harnesses ship, because the shared `AGENTS.md` block routes to those names.

### 6. Versions stay in lockstep

Both manifests of a plugin carry the same `version` and `description`. This change is a minor bump for every plugin:

| Plugin | Version |
| --- | --- |
| `andes-core` | 1.7.0 |
| `andes-dotnet` | 1.5.0 |
| `andes-angular` | 1.3.0 |
| `andes-dotnet-wasm`, `andes-github`, `andes-terraform`, `andes-azure-devops` | 1.1.0 |

### 7. Top-level folder names

ADR-001 sketched `plugins/claude/` and `plugins/copilot/`. VS Code encodes the source path into the name of each folder it copies. The longest resulting path, measured for a five-letter Windows user name:

| Layout | `RorroRojas3` | `Andes-Software-Solutions` |
| --- | --- | --- |
| `plugins/<name>` (before) | 239 | 252 |
| `plugins/copilot/<name>` | 247 | 260 |
| `copilot/<name>` | 239 | 252 |

Windows limits a path to 259 characters unless long paths are enabled. Top-level folders keep the length where it was.

## Audit rules

| Rule | Fails when |
| --- | --- |
| `isolation/unexpected-entry` | A plugin root holds an entry outside its tree's allowlist, such as a root `plugin.json` in the Claude tree |
| `isolation/agent-file` | A Claude `agents/` folder holds anything but `<name>.md`, or a Copilot one anything but `<name>.agent.md` |
| `isolation/namespace-entry` | `com.github.copilot/` holds anything but `agents/` and `hooks/` |
| `isolation/tree-missing` | A plugin exists in one tree only |
| `isolation/tree-entry` | A tree holds a file beside its plugin folders |
| `isolation/legacy-tree` | `plugins/` exists |
| `isolation/root-marketplace` | `marketplace.json` or `.plugin/marketplace.json` exists; Copilot would read it first |
| `isolation/symlink` | The index holds a symbolic link under either tree |
| `mirror/missing`, `mirror/drift` | A shared file exists in one tree only, or its two copies differ |
| `manifests/claude-field` | A Claude manifest declares a component key |
| `manifests/marketplace-name`, `marketplace-parity` | A marketplace is not named `andes`, or the two list different plugins or owners |
| `manifests/marketplace-description` | An entry's description differs from its manifest |
| `manifests/marketplace-entry-version` | An entry carries a version |
| `mcp/claude-missing` | A plugin ships `mcp.json` but no `.mcp.json` |
| `hooks/harness-flag` | A hook passes the other harness's name to a script |

**Changed.** `manifests/version-bump` watches both trees. It reads the earlier version from the new path, then from `plugins/<name>/`, so a base that predates the split is still checked. Content checks read each mirrored file once, from the Claude tree.

**Removed.** `manifests/default-dir`, `manifests/claude-agent-unlisted`, `manifests/claude-agent-ghost`, `hooks/claude-path`, and `hooks/claude-unlisted`.

## Consequences

**Positive:**

- No precedence rule decides which agents load. A folder holds one format.
- The Claude tree is a standard Claude Code plugin, so the manifest no longer lists each agent.
- `claude --plugin-dir claude` loads every plugin at once.

**Negative:**

- Shared files exist twice, and an edit needs a sync before the audit passes.
- A description now lives in four places per plugin: two manifests and two marketplace entries.
- Installs made before this change point at folders that no longer exist. Update the marketplace, then the plugins.

**Neutral:**

- A change to one harness's agent still bumps the plugin in both trees.

## Alternatives Considered

**Keep one folder per plugin.**

- Pros: No duplicated files.
- Cons: Any client that hands the folder to a second harness loads the wrong agents.

**A third, neutral source folder for shared files.**

- Pros: Neither harness tree would be the source of the other.
- Cons: Three copies of every shared file, and no tree can be loaded live before a sync.

**Symbolic links to one shared folder.**

- Pros: One copy on disk.
- Cons: A Windows checkout turns a link into a text file unless `core.symlinks` is on. Agent Plugins 1.0 rejects links that leave the plugin root.

**A decoy Agent Plugins manifest in the Claude tree.**

- Pros: A Copilot client that reaches the Claude tree would load no Claude agents.
- Cons: It puts a Copilot file back into the Claude tree.

## Client checks

**Run from the working tree with `--plugin-dir`, on 2026-09-29:**

| Client | Given | Result |
| --- | --- | --- |
| Claude Code 2.1.284 | `claude/` | 27 skills, six agents, three hook events, and five MCP servers, each once |
| Claude Code 2.1.284 | `copilot/andes-core` | Four skills; no agents, hooks, or MCP servers |
| Copilot CLI 1.0.89 | `copilot/andes-core`, `copilot/andes-dotnet` | Both plugins listed at their new versions. Agents were not listed, because that needs a session. |
| Copilot CLI 1.0.89 | `claude/andes-core` | The plugin is listed. This confirms the direction named under check 5. |

**Not yet run, against an install from the marketplace.** Remove installs made before this change first.

| # | Client | Pass |
| --- | --- | --- |
| 1 | Claude Code, CLI and VS Code extension | Six agents as `andes-<plugin>:andes-<role>`, each once; each hook fires once |
| 2 | Copilot CLI 1.0.85 or later | Eleven agents, each once |
| 3 | VS Code 1.133 or later, Local and Copilot CLI sessions | Eleven agents, each loaded from `com.github.copilot/agents/` |
| 4 | VS Code, Claude session | No `.agent.md` agent appears |
| 5 | VS Code, in a workspace whose `.claude/settings.json` enables andes plugins | Copilot sessions show no agent loaded from `~/.claude/plugins/` |

Check 5 covers the one direction the layout cannot prevent. A Claude-tree folder that reaches a Copilot host is parsed in the Claude format.

## Known Limits

- **VS Code does not set `PLUGIN_ROOT` for Agent Plugins hooks** ([microsoft/vscode#335006](https://github.com/microsoft/vscode/issues/335006)), so the Copilot hooks may not run in VS Code Local sessions.
- **Older Copilot clients load no agents.** Copilot CLI before 1.0.85 and VS Code before 1.133 load the skills but not the agents.
- **Two repository addresses are in use.** The manifests and README name `RorroRojas3/awesome-claude-copilot`. The Claude Code marketplace on the affected machine was registered from `Andes-Software-Solutions/awesome-claude-copilot`. VS Code keys a marketplace by address, so the two can appear as separate installs.

## References

- Claude Code plugin manifest and marketplace references: <https://code.claude.com/docs/en/plugins-reference>, <https://code.claude.com/docs/en/plugin-marketplaces>
- Copilot CLI plugin reference (manifest precedence, marketplace lookup order, `com.github.copilot/`): <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- VS Code agent plugins: <https://code.visualstudio.com/docs/agent-customization/agent-plugins>
- Agent Plugins 1.0 specification: <https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md>
