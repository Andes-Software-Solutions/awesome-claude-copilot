// Fixtures are built in a temp dir at run time: committed broken links would fail the audit's links check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractLinks, findBrokenLinks, headingAnchors, readPayload, runHook } from '../../plugins/andes-core/scripts/check-links.mjs';

const SCRIPT = fileURLToPath(new URL('../../plugins/andes-core/scripts/check-links.mjs', import.meta.url));
const FENCE = '```';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'andes-links-'));
  mkdirSync(join(root, '.git'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const targets = (text) => extractLinks(text).map((l) => l.target);

test('extracts inline links, images, angle destinations, titles, nested parentheses, and definitions', () => {
  const text = [
    'See [a](a.md) and ![img](img/x.png "Title").',
    'Angle [b](<docs/with space.md>) and [c](c_(1).md).',
    '[![badge](badge.svg)](d.md)',
    '',
    '[ref]: ref.md "t"',
    '[^1]: not a link definition',
  ].join('\n');
  assert.deepEqual(targets(text), ['a.md', 'img/x.png', 'docs/with space.md', 'c_(1).md', 'badge.svg', 'd.md', 'ref.md']);
});

test('ignores links in fenced code, inline code, HTML comments, and escaped brackets', () => {
  const text = [
    `${FENCE}md`, '[x](fenced.md)', FENCE,
    '~~~', '[y](tilde.md)', '~~~',
    '1. Item', `   ${FENCE}bash`, '   echo [z](indented.md)', `   ${FENCE}`,
    'Inline `[q](code.md)` and ``[r](double.md)``.',
    '<!-- [c](comment.md) -->',
    '\\[not](escaped.md)',
    '[kept](kept.md)',
  ].join('\n');
  assert.deepEqual(targets(text), ['kept.md']);
});

test('reports 1-based line numbers', () => {
  assert.deepEqual(extractLinks('# T\n\ntext\n[a](a.md)').map((l) => l.line), [4]);
});

test('skips front matter', () => {
  assert.deepEqual(targets('---\nlink: "[x](front.md)"\n---\n[y](body.md)'), ['body.md']);
});

test('builds GitHub anchors: punctuation, code, links, duplicates, setext, explicit ids', () => {
  const text = [
    '# Store shape & providing',
    '## `@ngrx/signals/rxjs-interop`',
    '## 3. `se-technical-writer`: Haiku → Sonnet',
    '## See [the guide](x.md) _now_',
    '## snake_case stays',
    '## Repeat', '## Repeat',
    'Setext title', '============',
    '<a id="Custom-Id"></a>',
    '---', 'not: a heading after front matter',
  ].join('\n');
  const anchors = headingAnchors(text);
  for (const a of ['store-shape--providing', 'ngrxsignalsrxjs-interop', '3-se-technical-writer-haiku--sonnet',
    'see-the-guide-now', 'snake_case-stays', 'repeat', 'repeat-1', 'setext-title', 'custom-id']) {
    assert.ok(anchors.has(a), `missing #${a} in ${[...anchors].join(', ')}`);
  }
});

test('a paragraph line followed by --- is a setext heading, a list item is not', () => {
  const anchors = headingAnchors('Intro text\n---\n\n- item\n---\n');
  assert.ok(anchors.has('intro-text'));
  assert.ok(!anchors.has('item'));
});

test('finds missing files, missing anchors, and case mismatches; accepts valid ones', () => {
  const root = fixture({
    'docs/guide.md': '# Guide\n\n## Install steps\n',
    'docs/Other.md': '# Other\n',
    'README.md': [
      '# Readme',
      '[ok](docs/guide.md#install-steps)',
      '[ok dir](docs/)',
      '[ok root](/docs/guide.md)',
      '[ok self](#readme)',
      '[ok encoded](docs/guide.md?plain=1#guide)',
      '[external](https://example.com/missing.md)',
      '[mail](mailto:a@b.c)',
      '[line anchor](docs/guide.md#L10)',
      '[missing](docs/nope.md)',
      '[bad anchor](docs/guide.md#setup)',
      '[bad self](#nowhere)',
      '[case](docs/other.md)',
    ].join('\n'),
  });
  try {
    const broken = findBrokenLinks(join(root, 'README.md'));
    assert.deepEqual(broken.map((b) => [b.line, b.target]), [
      [10, 'docs/nope.md'], [11, 'docs/guide.md#setup'], [12, '#nowhere'], [13, 'docs/other.md'],
    ]);
    assert.match(broken[0].reason, /^no such file$/);
    assert.match(broken[1].reason, /#setup/);
    assert.match(broken[3].reason, /Other\.md' differs only in letter case/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reads Claude, Copilot (object and string toolArgs), and VS Code payloads', () => {
  assert.deepEqual(readPayload({ cwd: '/r', tool_name: 'Write', tool_input: { file_path: '/r/a.md', content: 'x' } }),
    { file: '/r/a.md', cwd: '/r', newText: 'x', partial: false, failed: false });
  assert.equal(readPayload({ tool_input: { file_path: 'a.md', old_string: 'o', new_string: 'n' } }).partial, true);
  const copilot = readPayload({ cwd: '/r', toolName: 'edit', toolArgs: JSON.stringify({ path: 'a.md', old_str: 'o', new_str: 'n' }), toolResult: { resultType: 'success' } });
  assert.deepEqual([copilot.file, copilot.newText, copilot.partial, copilot.failed], ['a.md', 'n', true, false]);
  assert.equal(readPayload({ toolArgs: { path: 'a.md' }, toolResult: { resultType: 'failure' } }).failed, true);
  assert.equal(readPayload({ tool_input: { filePath: 'b.md' } }).file, 'b.md');
});

test('hook output: Claude blocks with a reason, Copilot adds context', () => {
  const root = fixture({ 'a.md': '[x](missing.md)\n' });
  try {
    const claude = runHook({ cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'a.md'), content: '' } }, { harness: 'claude' });
    assert.equal(claude.decision, 'block');
    assert.match(claude.reason, /line 1: `missing\.md` — no such file/);
    const copilot = runHook({ cwd: root, toolName: 'create', toolArgs: JSON.stringify({ path: 'a.md' }) }, { harness: 'copilot' });
    assert.deepEqual(Object.keys(copilot), ['additionalContext']);
    assert.equal(runHook({ cwd: root, toolArgs: { path: 'a.md' } }).additionalContext !== undefined, true, 'infers Copilot from toolArgs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an edit reports only links it introduced, plus same-file anchors', () => {
  const root = fixture({ 'a.md': '# A\n[old](old-missing.md)\n[new](new-missing.md)\n[self](#gone)\n' });
  try {
    const out = runHook({ cwd: root, tool_input: { file_path: join(root, 'a.md'), old_string: 'x', new_string: '[new](new-missing.md)' } }, { harness: 'claude' });
    assert.match(out.reason, /new-missing\.md/);
    assert.match(out.reason, /#gone/);
    assert.doesNotMatch(out.reason, /old-missing\.md/);
    assert.equal(runHook({ cwd: root, tool_input: { file_path: join(root, 'a.md'), old_string: 'x', new_string: 'prose' } }, { harness: 'claude' }).reason.includes('old-missing'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stays silent outside cwd, for non-Markdown, failed tools, node_modules, and ANDES_LINK_CHECK=off', () => {
  const root = fixture({ 'proj/a.md': '[x](missing.md)\n', 'plans/p.md': '[x](missing.md)\n', 'proj/node_modules/m/r.md': '[x](missing.md)\n', 'proj/b.txt': '[x](missing.md)\n' });
  const proj = join(root, 'proj');
  const hook = (file, extra = {}) => runHook({ cwd: proj, tool_input: { file_path: file, content: '' }, ...extra }, { harness: 'claude', env: {} });
  try {
    assert.equal(hook(join(root, 'plans/p.md')), null);
    assert.equal(hook(join(proj, 'b.txt')), null);
    assert.equal(hook(join(proj, 'node_modules/m/r.md')), null);
    assert.equal(runHook({ cwd: proj, toolArgs: { path: 'a.md' }, toolResult: { resultType: 'failure' } }, { harness: 'copilot' }), null);
    assert.equal(runHook({ cwd: proj, tool_input: { file_path: 'a.md', content: '' } }, { harness: 'claude', env: { ANDES_LINK_CHECK: 'off' } }), null);
    assert.notEqual(hook(join(proj, 'a.md')), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the plugin hook defers to an installed repo hook only when asked to', () => {
  const root = fixture({ 'a.md': '[x](missing.md)\n' });
  const payload = { cwd: root, toolArgs: { path: 'a.md' } };
  try {
    assert.notEqual(runHook(payload, { harness: 'copilot', defer: true }), null, 'no repo hook installed yet');
    mkdirSync(join(root, '.github/hooks/andes'), { recursive: true });
    writeFileSync(join(root, '.github/hooks/andes-links.json'), '{}');
    writeFileSync(join(root, '.github/hooks/andes/check-links.mjs'), '');
    assert.equal(runHook(payload, { harness: 'copilot', defer: true }), null);
    assert.notEqual(runHook(payload, { harness: 'copilot' }), null, 'the repo copy itself never defers');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('hook mode exits 0 on bad input and prints nothing', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--harness=copilot'], { input: 'not json', encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  assert.equal(out, '');
});

test('CLI mode exits 10 with file:line findings', () => {
  const root = fixture({ 'a.md': '\n[x](missing.md)\n' });
  try {
    execFileSync(process.execPath, [SCRIPT, join(root, 'a.md')], { encoding: 'utf8' });
    assert.fail('expected exit 10');
  } catch (err) {
    assert.equal(err.status, 10);
    assert.match(err.stdout, /a\.md:2: missing\.md — no such file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
