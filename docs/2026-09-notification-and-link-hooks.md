# Notification and link-check hooks

**Date:** 2026-09-29. **Status:** accepted; verified on Claude Code, Copilot checks pending ([checklist](#not-verified-copilot-checklist)). Amends [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) §1: the default `hooks/` folder stays banned, and plugin hooks live in `claude-hooks/` and `com.github.copilot/hooks/`.

## Why

- **Waiting goes unnoticed.** A permission prompt, a question from the agent, or a finished turn sits in the terminal until you look. On a long task you come back to an agent that stopped minutes ago.
- **Broken links ship.** `andes-se-technical-writer` and `andes-prd-generator` write Markdown that links to other docs, headings, and files. A wrong relative path or a renamed heading passes review and turns into a 404 or a dead anchor on github.com. Nothing checked them.

A hook runs on its event whether or not the model remembers to, and Claude Code and Copilot CLI both run hooks that ship in a plugin.

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-core` | 1.6.0 | `claude-hooks/hooks.json` and `com.github.copilot/hooks/hooks.json`, both running `scripts/notify.mjs` and `scripts/check-links.mjs`; `andes-init` offers the link check to the Copilot cloud agent (`assets/copilot-hooks.json`) |

In this repository only: the audit's `hooks` and `links` checks, `node:test` suites in `scripts/tests/`, and a CI step, "Test hook scripts". The PR path filter gains `**/*.md`.

| Purpose | Claude Code | Copilot | Runs |
| --- | --- | --- | --- |
| Needs you | `Notification`, matcher `permission_prompt\|elicitation_dialog` | `notification`, same matcher | `notify.mjs --event=notification` |
| Turn finished | `Stop` | `agentStop` | `notify.mjs --event=stop` |
| Markdown written | `PostToolUse`, matcher `Write\|Edit` | `postToolUse`, matcher `edit\|create` | `check-links.mjs` |

**`notify.mjs`**

- **Where it shows.** macOS: `osascript`, with the text passed as arguments, never as script source. Linux: `notify-send` when `DISPLAY`, `WAYLAND_DISPLAY`, or `DBUS_SESSION_BUS_ADDRESS` is set. Windows: a WinRT toast from Windows PowerShell 5.1, launched with `-EncodedCommand` and the text in environment variables.
- **Fallback.** With no notifier, or in an SSH session, the terminal bell rings: `{"terminalSequence":"\u0007"}` on Claude Code, a BEL written to `/dev/tty` on Copilot.
- **Silent.** In cloud and headless sessions (`CLAUDE_CODE_REMOTE=true`, `CI`, `GITHUB_ACTIONS`, or a `CLAUDE_CODE_ENTRYPOINT` starting with `sdk-` or `remote`), and when another Stop hook is already continuing the turn.
- **`ANDES_NOTIFY`.** `all` (default), `attention` (no turn-finished alerts), or `off`. The script always exits 0.

**`check-links.mjs`**

- **Checks.** Relative files and images, `<dest>` links, reference definitions, HTML `href` and `src`, `/`-rooted links (from the repository root), and `#anchors` by GitHub's slug rules: duplicates get `-1`, setext headings count, and so do explicit `id` / `name` attributes. Letter case must match, because github.com is case-sensitive. Inside a git checkout, a link that climbs out of the repository is broken even if its target exists on disk.
- **Skips.** Code fences, inline code, HTML comments, front matter, and external schemes.
- **Hook mode.** Silent for non-Markdown files, files outside the session's working directory, `node_modules`, files over 1 MB, failed Copilot tool calls, and `ANDES_LINK_CHECK=off`. It fails open: exit 0 on any error.
- **CLI mode.** `node check-links.mjs <files>` prints `file:line` findings and exits `0` clean, `10` findings, `1` error.

Both scripts need Node.js 18 or later on `PATH`.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Ship the hooks in `andes-core` | Every consumer installs it, and it ships the two agents that write the most Markdown. A separate plugin would be one more manual install on Copilot, which has no `dependencies`. |
| D2 | Claude hooks live in `claude-hooks/hooks.json`, declared by `"hooks": "./claude-hooks/hooks.json"` in `.claude-plugin/plugin.json`; `hooks/` stays banned | Claude Code auto-loads a plugin's `hooks/` folder, and Copilot's legacy format and VS Code's Claude-format detection read it too, so one harness would load the other's hooks. Agent Plugins 1.0 reads plugin hooks only from `com.github.copilot/hooks/hooks.json`, so the Copilot manifest still has no `hooks` field. |
| D3 | Two hook files, one script per purpose, paired by the audit's `hookEventMap` | The formats differ: Claude uses PascalCase events, matcher groups, and `timeout`; Copilot uses `"version": 1`, camelCase events, `bash` / `powershell` commands, and `timeoutSec`. The scripts hold the logic, and the audit keeps each event pair on the same script. `idle_prompt` is left out: it fires about 60 s after `Stop`, so one finished turn would alert twice. |
| D4 | Claude handlers use exec form; Copilot entries carry guarded `bash` and `powershell` commands | Exec form (`"command": "node"`, `"args": ["${CLAUDE_PLUGIN_ROOT}/scripts/…"]`) has no shell to parse the path, so a cache path with spaces needs no quoting. `claude plugin validate --strict` accepts it on 2.1.283 (the CI pin) and 2.1.284. On Claude a missing `node` shows a non-blocking hook error; on Copilot the `command -v node` and `Get-Command node` guards exit quietly. PowerShell sets UTF-8 `$OutputEncoding` and pipes `$input` to `node`. |
| D5 | Each harness gets output on the channel that reaches the right reader | Copilot injects a `notification` hook's stdout as a user message, so `notify.mjs` never prints there and writes the bell to `/dev/tty`; Claude gets a `terminalSequence`. Link findings go to the model: `{"decision":"block","reason"}` on Claude, where the write already ran and `block` only feeds the reason back, and `{"additionalContext"}` on Copilot, where exit 2 reaches only the user. |
| D6 | Local links only, no network | The hook runs after every Markdown write. Fetching URLs would make each edit slow and flaky and send every URL in the document out of the session. |
| D7 | A new file reports every broken link; an edit reports only links in its new text, plus same-file anchors | Links that were already broken would otherwise come back on every small edit to a large file. Same-file anchors stay in scope because an edit can rename a heading that other lines link to. |
| D8 | Files outside the session's working directory are skipped | Plan, memory, and session files live outside the project and link into it from elsewhere, so their relative links would all read as broken. |
| D9 | The plugin's Copilot link hook passes `--defer-to-repo-hook` | Copilot CLI also loads the repository's `.github/hooks/*.json`. When `.github/hooks/andes-links.json` and `.github/hooks/andes/check-links.mjs` both exist, the plugin hook stands down, so each finding is reported once. Claude Code never reads `.github/hooks/`, so its hook does not defer. |
| D10 | `andes-init` offers the link check to the Copilot cloud agent as repository files | The cloud agent never loads plugins: it reads only `.github/hooks/*.json`, runs only `bash`, and has no `notification` event. `andes-init` copies `assets/copilot-hooks.json` to `.github/hooks/andes-links.json` and the script to `.github/hooks/andes/check-links.mjs`, and refreshes either on a re-run when it differs. That copy is why the script is one file that imports only `node:` built-ins (`hooks/script-imports`). |
| D11 | The audit's `links` check imports the hook's checker | CI and the hook agree on what is broken. It covers every tracked, or untracked and not ignored, `*.md`, `*.mdx`, and `*.markdown` file, except upstream-pinned skills (their links are upstream's to fix) and `andes-init/assets/` (templates whose links resolve in the consumer repo). `scripts/release.mjs` runs the audit, so a broken link also blocks a release. |
| D12 | The opt-outs are environment variables, `ANDES_NOTIFY` and `ANDES_LINK_CHECK` | Plugins cannot ship settings, and disabling `andes-core` would also remove its skills and agents. Claude Code's own terminal notifications can double up with these in iTerm2, kitty, and Ghostty; `ANDES_NOTIFY=attention` or `off` is the remedy. |

## Audit rules

| Rule | Severity | Fails when |
| --- | --- | --- |
| `hooks/claude-path` | error | `.claude-plugin/plugin.json` declares `hooks` as anything but `./claude-hooks/hooks.json`, or declares it and the file is missing |
| `hooks/claude-unlisted` | error | `claude-hooks/hooks.json` exists but the manifest does not declare it |
| `hooks/copilot-missing` | error | A plugin ships Claude hooks but no `com.github.copilot/hooks/hooks.json` |
| `hooks/claude-missing` | error | A plugin ships Copilot hooks but no Claude hooks |
| `hooks/claude-format` | error | The file has no `hooks` object, or a handler is not `type: "command"` running `${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs` |
| `hooks/copilot-format` | error | The file is not `"version": 1`; an entry lacks `type: "command"`, a numeric `timeoutSec`, or `bash` (`$PLUGIN_ROOT`) and `powershell` (`$env:PLUGIN_ROOT`) commands; or the two commands run different scripts |
| `hooks/harness-drift` | error | An event pair in `hookEventMap` runs different scripts, or an event has no counterpart |
| `hooks/script-missing` | error | A hook runs a script that does not exist |
| `hooks/script-imports` | error | A hook script imports anything but `node:` built-ins |
| `links/broken` | error | A local link or anchor in an audited Markdown file does not resolve |
| `links/checker-missing` | error | `plugins/andes-core/scripts/check-links.mjs` fails to load |
| `links/no-git` | warning | The repository is not a git checkout, so the link check is skipped |

## Verified

On Claude Code 2.1.284, in a cloud container:

- `claude plugin validate --strict` passes for the marketplace and `andes-core`, and the audit is clean.
- All 24 `node:test` cases pass. Negative audit runs catch a broken link, a missing Copilot hooks file, event drift, and a missing script.
- A live `claude -p --plugin-dir plugins/andes-core` session wrote a README with a broken link, and the `PostToolUse` block reason reached the model.
- The `Stop` hook ran and stayed silent, as it should in a remote session.

## Not verified: Copilot checklist

No Copilot CLI, cloud agent, desktop session, or Windows machine was available. Run these locally, in order, with `andes-core` 1.6.0 or later installed (`copilot plugin install andes-core@andes`) and Node.js 18 or later on `PATH`.

1. **Copilot CLI loads the plugin's hooks and sets `PLUGIN_ROOT`.**
   - Steps: in a git repository, ask the agent to create `notes.md` containing `[x](missing.md)`.
   - Pass: the agent's next step cites the andes link finding for `missing.md` and fixes or removes the link. A hook error naming `/scripts/check-links.mjs` means `PLUGIN_ROOT` was empty; no output at all means the hooks file was not loaded.
2. **The `notification` matcher matches `notification_type`, and nothing leaks into the chat.**
   - Steps: ask for a shell command that needs your approval, and leave the prompt open.
   - Pass: one desktop notification titled `GitHub Copilot — <repo>`, and no new user message in the conversation. If nothing fires, remove the matcher locally and retry, to tell a matcher mismatch from a missing event.
3. **`agentStop` fires once per turn.**
   - Steps: send a short prompt and let the turn end. Repeat with `ANDES_NOTIFY=attention`.
   - Pass: one "Finished — ready for your next message" notification per turn, and none with `attention`.
4. **The PowerShell handler forwards stdin on Windows.**
   - Steps: repeat check 1 in Copilot CLI on Windows.
   - Pass: the link finding reaches the agent. The notifier reads its event from arguments, so only the link check proves that `$input` forwarded the payload.
5. **The plugin hook defers to the repository hook.**
   - Steps: run `andes-init`, accept the cloud-agent link check, then repeat check 1.
   - Pass: the finding appears once, not twice.
6. **The Copilot cloud agent runs the repository hook.**
   - Steps: commit `.github/hooks/andes-links.json` and `.github/hooks/andes/check-links.mjs`, then assign Copilot an issue that asks for a README linking to a file that does not exist.
   - Pass: the session log shows the andes finding and the agent corrects the link. That confirms its edit tools match `edit|create` and that the hook runs from the repository root, which the relative script path assumes.
7. **Desktop pop-ups on each OS, on both harnesses.**
   - Steps: trigger a permission prompt on macOS, on Linux in a desktop session with `notify-send` installed, and on Windows.
   - Pass: a banner on each. On macOS the first one may need notifications allowed for Script Editor in System Settings. On Windows the toast is attributed to Windows PowerShell. Over SSH the terminal bell rings instead.
8. **VS Code, if it loads the plugin's hooks.**
   - Steps: edit a `.ts` file, then write a `.md` file with a broken link.
   - Pass: silence after the `.ts` edit and one finding for the `.md` file. VS Code's Local target ignores matchers, so the scripts filter by file extension themselves. It has no notification event, so permission prompts raise no alert there.

## References

- Claude Code hooks reference: <https://code.claude.com/docs/en/hooks>
- Claude Code plugins reference (the manifest `hooks` field, `${CLAUDE_PLUGIN_ROOT}`): <https://code.claude.com/docs/en/plugins-reference>
- GitHub Copilot hooks configuration reference: <https://docs.github.com/en/copilot/reference/hooks-configuration>
- Copilot CLI plugin reference: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- Agent Plugins 1.0 specification: <https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md>
- VS Code hooks: <https://code.visualstudio.com/docs/copilot/customization/hooks>
