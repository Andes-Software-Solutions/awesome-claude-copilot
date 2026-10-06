import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Each harness tree ships its own copy; scripts/tests/run.mjs runs this suite once per tree.
const SCRIPT_URL = new URL(`../../${process.env.ANDES_TREE ?? 'claude'}/andes-core/scripts/notify.mjs`, import.meta.url);
const SCRIPT = fileURLToPath(SCRIPT_URL);
const { planNotification } = await import(SCRIPT_URL.href);
const everywhere = (c) => `/usr/bin/${c}`;
const nowhere = () => null;
const plan = (over = {}) => planNotification({ platform: 'darwin', env: {}, harness: 'claude', payload: { cwd: '/w/shop', message: 'Claude needs your permission to use Bash' }, which: everywhere, ...over });

test('macOS passes title and body as osascript argv, never inside the script', () => {
  const p = plan();
  assert.equal(p.kind, 'spawn');
  assert.equal(p.cmd, '/usr/bin/osascript');
  assert.deepEqual(p.args.slice(-2), ['Claude Code — shop', 'Claude needs your permission to use Bash']);
  assert.ok(!p.args.slice(0, -2).join(' ').includes('shop'));
});

test('Linux uses notify-send when a desktop session exists, otherwise rings the bell', () => {
  const p = plan({ platform: 'linux', env: { DISPLAY: ':0' } });
  assert.deepEqual([p.cmd, ...p.args], ['/usr/bin/notify-send', '-a', 'andes', '--', 'Claude Code — shop', 'Claude needs your permission to use Bash']);
  assert.equal(plan({ platform: 'linux', env: {} }).kind, 'bell');
  assert.equal(plan({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-0' }, which: nowhere }).kind, 'bell');
});

test('Windows runs a PowerShell 5.1 toast with the text in env vars', () => {
  const p = plan({ platform: 'win32', harness: 'copilot' });
  assert.equal(p.cmd, '/usr/bin/powershell');
  assert.equal(p.wait, true);
  assert.ok(!plan().wait);
  assert.ok(p.args.includes('-EncodedCommand'));
  assert.deepEqual(p.env, { ANDES_NOTIFY_TITLE: 'GitHub Copilot — shop', ANDES_NOTIFY_BODY: 'Claude needs your permission to use Bash' });
  const script = Buffer.from(p.args.at(-1), 'base64').toString('utf16le');
  assert.match(script, /SecurityElement\]::Escape\(\$env:ANDES_NOTIFY_BODY\)/);
});

test('a payload without a message still says why', () => {
  assert.equal(plan({ payload: {} }).args.at(-1), 'Needs your attention');
});

test('ANDES_NOTIFY=off silences it; any other value notifies', () => {
  assert.equal(plan({ env: { ANDES_NOTIFY: 'off' } }).kind, 'skip');
  assert.equal(plan({ env: { ANDES_NOTIFY: 'attention' } }).kind, 'spawn');
});

test('headless, cloud, and CI sessions stay silent; SSH rings the bell', () => {
  for (const env of [{ CLAUDE_CODE_REMOTE: 'true' }, { CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }, { CLAUDE_CODE_ENTRYPOINT: 'remote_mobile' }]) {
    assert.equal(plan({ env }).kind, 'skip', JSON.stringify(env));
  }
  assert.equal(plan({ env: { CLAUDE_CODE_ENTRYPOINT: 'cli' } }).kind, 'spawn');
  assert.equal(plan({ env: { SSH_CONNECTION: '1 2 3 4' } }).kind, 'bell');
});

test('long messages are clipped to one line', () => {
  const body = plan({ payload: { message: `line one\n${'x'.repeat(400)}` } }).args.at(-1);
  assert.equal(body.length, 200);
  assert.ok(!body.includes('\n'));
});

test('Copilot never prints to stdout; Claude prints only a bell sequence', () => {
  const env = { PATH: '', HOME: process.env.HOME };
  const run = (harness) => execFileSync(process.execPath, [SCRIPT, `--harness=${harness}`, '--platform=linux'],
    { input: JSON.stringify({ message: 'hi' }), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'ignore'] });
  assert.equal(run('copilot'), '');
  assert.deepEqual(JSON.parse(run('claude')), { terminalSequence: '\u0007' });
});

test('--dry-run prints the plan to stderr and nothing to stdout', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--harness=copilot', '--dry-run'],
    { input: '{}', encoding: 'utf8', env: { PATH: '', CI: 'true' }, stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(out, '');
});
