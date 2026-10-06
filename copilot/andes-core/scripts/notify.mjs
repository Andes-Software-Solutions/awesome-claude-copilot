#!/usr/bin/env node
// Desktop notification when the agent needs you (a permission prompt or a question).
//
//   node notify.mjs --harness=claude|copilot [--dry-run] [--platform=<os>]
//
// The payload arrives on stdin; a shell that drops stdin still notifies, with a generic body.
// Always exits 0 — a notifier must never interrupt the session.
//
// Output contract:
//   Claude Code  prints nothing, or {"terminalSequence":"\u0007"} when no desktop notifier exists.
//   Copilot      prints nothing, ever: a notification hook's stdout becomes a user message.
//
// ANDES_NOTIFY=off silences it; any other value notifies.

import { openSync, readFileSync, realpathSync, statSync, writeSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { basename, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Windows PowerShell 5.1 (not pwsh) carries the WinRT projection the toast API needs. The AppId is
// PowerShell's own, so the toast needs no Start-menu shortcut registration.
const WINDOWS_TOAST = [
  '$ErrorActionPreference = "Stop"',
  '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
  '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null',
  '$t = [Security.SecurityElement]::Escape($env:ANDES_NOTIFY_TITLE)',
  '$b = [Security.SecurityElement]::Escape($env:ANDES_NOTIFY_BODY)',
  '$x = New-Object Windows.Data.Xml.Dom.XmlDocument',
  "$x.LoadXml(\"<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>\")",
  '$app = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe"',
  '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($x))',
].join('; ');

const WAIT_MS = 8000;

/** First match for `cmd` on PATH (PATHEXT-aware on Windows), or null. */
export function onPath(cmd, { env = process.env, platform = process.platform } = {}) {
  const exts = platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  const dirs = (env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, cmd + ext);
      try { if (statSync(candidate).isFile()) return candidate; } catch { /* not here */ }
    }
  }
  return null;
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Decides how to notify, without side effects:
 * { kind: 'spawn', cmd, args, env } | { kind: 'bell', reason } | { kind: 'skip', reason }.
 */
export function planNotification({ platform = process.platform, env = process.env, harness = 'claude', payload = {}, which = (c) => onPath(c, { env, platform }) } = {}) {
  const mode = String(env.ANDES_NOTIFY ?? 'all').toLowerCase();
  if (['off', '0', 'false', 'none'].includes(mode)) return { kind: 'skip', reason: 'ANDES_NOTIFY=off' };
  if (env.CLAUDE_CODE_REMOTE === 'true' || env.CI || env.GITHUB_ACTIONS || /^(sdk-|remote)/.test(env.CLAUDE_CODE_ENTRYPOINT ?? '')) {
    return { kind: 'skip', reason: 'headless or cloud session' };
  }

  const app = harness === 'copilot' ? 'GitHub Copilot' : 'Claude Code';
  const project = basename(payload.cwd || process.cwd());
  const title = clip(project ? `${app} — ${project}` : app, 80);
  const text = payload.message || payload.title || 'Needs your attention';
  const body = clip(String(text).replace(/\s+/g, ' ').replace(/^-+\s*/, '').trim(), 200);

  // Over SSH a desktop notifier would fire on the remote machine; the bell travels to the local terminal.
  if (env.SSH_CONNECTION || env.SSH_TTY) return { kind: 'bell', reason: 'ssh session' };
  if (platform === 'darwin') {
    const cmd = which('osascript');
    if (cmd) {
      // Text goes in argv, never into AppleScript source.
      return { kind: 'spawn', cmd, args: ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', title, body] };
    }
  } else if (platform === 'win32') {
    const cmd = which('powershell');
    if (cmd) {
      return {
        kind: 'spawn', cmd, wait: true,
        // -EncodedCommand sidesteps Windows PowerShell's command-line quote handling.
        args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(WINDOWS_TOAST, 'utf16le').toString('base64')],
        env: { ANDES_NOTIFY_TITLE: title, ANDES_NOTIFY_BODY: body },
      };
    }
  } else if (env.DISPLAY || env.WAYLAND_DISPLAY || env.DBUS_SESSION_BUS_ADDRESS) {
    const cmd = which('notify-send');
    if (cmd) return { kind: 'spawn', cmd, args: ['-a', 'andes', '--', title, body] };
  }
  return { kind: 'bell', reason: 'no desktop notifier available' };
}

function ringTerminal(harness, platform) {
  if (harness === 'claude') {
    process.stdout.write(`${JSON.stringify({ terminalSequence: '\u0007' })}\n`);
    return;
  }
  if (platform === 'win32') return;
  try {
    const fd = openSync('/dev/tty', 'w');
    writeSync(fd, '\u0007');
    closeSync(fd);
  } catch { /* no controlling terminal */ }
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const harness = arg('harness') === 'copilot' ? 'copilot' : 'claude';
  const platform = arg('platform') ?? process.platform;
  let payload = {};
  try {
    if (!process.stdin.isTTY) {
      const input = readFileSync(0, 'utf8');
      if (input.trim()) payload = JSON.parse(input);
    }
  } catch { /* notify without payload details */ }

  const plan = planNotification({ platform, harness, payload });
  if (argv.includes('--dry-run')) {
    process.stderr.write(`${JSON.stringify(plan)}\n`);
    return;
  }
  if (plan.kind === 'bell') ringTerminal(harness, platform);
  if (plan.kind !== 'spawn') return;
  // On Windows a detached PowerShell never shows the toast, and an attached one dies when the hook
  // exits, so the hook waits for it — capped below the 10 s hook timeout.
  const child = spawn(plan.cmd, plan.args, {
    detached: !plan.wait, stdio: 'ignore', windowsHide: true, env: { ...process.env, ...plan.env },
  });
  child.on('error', () => {});
  if (plan.wait) setTimeout(() => child.kill(), WAIT_MS).unref();
  else child.unref();
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  try { main(); } catch (err) { process.stderr.write(`andes notify: ${err.message}\n`); }
}
