#!/usr/bin/env node
// Release the andes marketplace from `main`.
//
// Plugins are versioned individually and bumped in the PR that changes them (repo-audit --base
// enforces it). A release is the marketplace-level event: the CHANGELOG's `## [Unreleased]`
// section becomes `## [X.Y.Z] - <date>`, that roll is committed and tagged `vX.Y.Z`, both are
// pushed, and a GitHub Release carries the section plus a table of the plugin versions it ships.
//
//   node scripts/release.mjs <major|minor|patch|X.Y.Z> [--dry-run]
//
// Exit codes: 0 released (or the dry run printed), 2 a precondition failed, 1 the script failed.
// Without --dry-run the script writes CHANGELOG.md, one commit, one tag, and one GitHub Release —
// nothing else. Node built-ins only, like scripts/repo-audit.mjs.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';

process.on('uncaughtException', (err) => {
  console.error(`Release failed: ${err.message}`);
  process.exit(1);
});

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const bump = args.find((a) => !a.startsWith('--'));
if (!bump || !/^(major|minor|patch|\d+\.\d+\.\d+)$/.test(bump)) {
  console.error('Usage: node scripts/release.mjs <major|minor|patch|X.Y.Z> [--dry-run]');
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
// gh and claude are .cmd shims on Windows, which spawnSync only resolves through a shell.
const tool = (cmd, a, stdio = 'inherit') => spawnSync(cmd, a, { cwd: ROOT, stdio, shell: WIN }).status;
const blocked = (msg) => {
  console.error(`Release blocked: ${msg}`);
  process.exit(2);
};

// --- preconditions ------------------------------------------------------------
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') blocked(`releases are cut from main, not '${branch}'`);
if (git('status', '--porcelain')) blocked('the working tree is not clean');
if (tool('git', ['fetch', '--quiet', 'origin', 'main', '--tags']) !== 0) blocked('git fetch origin failed');
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) blocked('main is not in sync with origin/main — pull or push first');
if (tool('gh', ['auth', 'status'], 'ignore') !== 0) blocked('gh is not authenticated (run `gh auth login`)');
if (spawnSync(process.execPath, [join(ROOT, 'scripts/repo-audit.mjs')], { cwd: ROOT, stdio: 'inherit' }).status !== 0) blocked('the repo audit is not clean');
if (tool('claude', ['--version'], 'ignore') === 0) {
  if (tool('claude', ['plugin', 'validate', '.']) !== 0) blocked('`claude plugin validate .` failed');
} else {
  console.warn('warning: the claude CLI is not on PATH; skipping `claude plugin validate .` (CI runs it on every PR)');
}

// --- versions -----------------------------------------------------------------
const semver = (v) => v.replace(/^v/, '').split('.').map(Number);
const cmp = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const tags = git('tag', '--list', 'v*').split('\n').filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).sort(cmp);
const previous = tags.at(-1) ?? null;
let next;
if (/^\d/.test(bump)) next = bump;
else {
  const [major, minor, patch] = semver(previous ?? 'v0.0.0');
  next = bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}
if (previous && cmp(next, previous) <= 0) blocked(`v${next} is not above the latest tag ${previous}`);
if (tags.includes(`v${next}`)) blocked(`tag v${next} already exists`);

const origin = git('remote', 'get-url', 'origin');
const repoMatch = origin.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/);
if (!repoMatch) blocked(`cannot derive the GitHub repository from origin '${origin}'`);
const repoUrl = `https://github.com/${repoMatch[1]}`;

// --- changelog ------------------------------------------------------------------
const changelogPath = join(ROOT, 'CHANGELOG.md');
if (!existsSync(changelogPath)) blocked('CHANGELOG.md is missing');
const raw = readFileSync(changelogPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.replace(/\r\n?/g, '\n').split('\n');
const start = lines.findIndex((l) => l.trim() === '## [Unreleased]');
if (start < 0) blocked('CHANGELOG.md has no `## [Unreleased]` section');
const isBoundary = (l) => /^## /.test(l) || /^\[[^\]]+\]: /.test(l);
let end = start + 1;
while (end < lines.length && !isBoundary(lines[end])) end++;
const trimBlank = (arr) => {
  let a = 0;
  let b = arr.length;
  while (a < b && !arr[a].trim()) a++;
  while (b > a && !arr[b - 1].trim()) b--;
  return arr.slice(a, b);
};
const section = trimBlank(lines.slice(start + 1, end));
if (!section.some((l) => /^\s*- /.test(l))) blocked('`## [Unreleased]` has no entries to release');

const date = new Date().toISOString().slice(0, 10);
const releaseHeading = `## [${next}] - ${date}`;
const rest = lines.slice(end);
const linkIdx = rest.findIndex((l) => /^\[[^\]]+\]: /.test(l));
const body = linkIdx < 0 ? trimBlank(rest) : trimBlank(rest.slice(0, linkIdx));
const links = (linkIdx < 0 ? [] : rest.slice(linkIdx)).filter((l) => l.trim() && !/^\[Unreleased\]: /.test(l));
const newLinks = [
  `[Unreleased]: ${repoUrl}/compare/v${next}...HEAD`,
  `[${next}]: ${previous ? `${repoUrl}/compare/${previous}...v${next}` : `${repoUrl}/releases/tag/v${next}`}`,
  ...links,
];
const updated = [
  ...lines.slice(0, start + 1), '',
  releaseHeading, '',
  ...section, '',
  ...(body.length ? [...body, ''] : []),
  ...newLinks, '',
].join('\n');

// --- release notes ----------------------------------------------------------------
// The audit holds both trees to one version per plugin (manifests/version-drift), so either manifest serves.
const pluginRows = readdirSync(join(ROOT, 'claude'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()
  .map((p) => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'claude', p, '.claude-plugin', 'plugin.json'), 'utf8'));
    return `| \`${p}\` | ${manifest.version} |`;
  });
const notes = [
  ...section, '',
  '### Plugin versions', '',
  '| Plugin | Version |', '| --- | --- |', ...pluginRows, '',
  previous ? `Full diff: ${repoUrl}/compare/${previous}...v${next}` : '',
].join('\n').trim() + '\n';

// --- act -----------------------------------------------------------------------------
console.log(`Release v${next}${previous ? ` (previous ${previous})` : ''} from main @ ${git('rev-parse', '--short', 'HEAD')}`);
console.log(`\n${releaseHeading}\n\n${section.join('\n')}\n`);
console.log('Plugin versions shipped:\n' + pluginRows.map((r) => `  ${r}`).join('\n'));
if (DRY) {
  console.log('\nDry run: nothing written. Without --dry-run this would:');
  console.log(`  1. rewrite CHANGELOG.md (move [Unreleased] under "${releaseHeading}", refresh the compare links)`);
  console.log(`  2. git commit -m "chore(release): v${next}"  ->  git tag -a v${next}  ->  git push origin main --follow-tags`);
  console.log(`  3. gh release create v${next} --title v${next} --notes-file <notes>`);
  process.exit(0);
}

writeFileSync(changelogPath, updated.replace(/\n/g, eol));
git('add', 'CHANGELOG.md');
git('commit', '-m', `chore(release): v${next}`);
git('tag', '-a', `v${next}`, '-m', `Release v${next}`);
if (tool('git', ['push', 'origin', 'main', '--follow-tags']) !== 0) {
  throw new Error('git push failed; the release commit and tag exist locally — fix the remote and push again');
}
const tmp = mkdtempSync(join(tmpdir(), 'andes-release-'));
try {
  const notesPath = join(tmp, 'notes.md');
  writeFileSync(notesPath, notes);
  if (tool('gh', ['release', 'create', `v${next}`, '--title', `v${next}`, '--notes-file', notesPath]) !== 0) {
    // Keep the notes file so the printed retry command works.
    const keep = join(ROOT, `release-notes-v${next}.md`);
    writeFileSync(keep, notes);
    throw new Error(`gh release create failed; main and tag v${next} are already pushed. Retry: gh release create v${next} --title v${next} --notes-file ${keep}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nReleased v${next}: ${repoUrl}/releases/tag/v${next}`);
