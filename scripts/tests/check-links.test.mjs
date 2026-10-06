// Fixtures are built in a temp dir at run time: committed broken links would fail the audit's links check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Maintainer tooling with one copy, so ANDES_TREE does not apply.
const SCRIPT_URL = new URL('../check-links.mjs', import.meta.url);
const SCRIPT = fileURLToPath(SCRIPT_URL);
const { extractLinks, findBrokenLinks, headingAnchors } = await import(SCRIPT_URL.href);
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

test('reports links that leave the repository even when the target exists', () => {
  const root = fixture({
    'outside.md': '# Out\n',
    'repo/.git/HEAD': '',
    'repo/docs/a.md': '[up](../../outside.md)\n[rooted](/../outside.md)\n[ok](../README.md)\n',
    'repo/README.md': '# Readme\n',
  });
  try {
    const broken = findBrokenLinks(join(root, 'repo/docs/a.md'));
    assert.deepEqual(broken.map((b) => [b.line, b.target]), [[1, '../../outside.md'], [2, '/../outside.md']]);
    assert.match(broken[0].reason, /^outside the repository/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI mode without files exits 1 with usage', () => {
  try {
    execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.fail('expected exit 1');
  } catch (err) {
    assert.equal(err.status, 1);
    assert.match(err.stderr, /usage:/);
  }
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
