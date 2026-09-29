#!/usr/bin/env node
// Mirrors each plugin's shared folders (skills/, scripts/) from one harness tree to the other.
//
// Neither harness loads files outside a plugin root, and symlinks do not survive a Windows
// checkout, so shared content exists once per tree. Edit it under claude/, then run this script.
// The audit (mirror/*) fails while the two copies differ.
//
//   node scripts/sync-shared.mjs                      copy claude/ -> copilot/
//   node scripts/sync-shared.mjs --from=copilot       copy copilot/ -> claude/
//   node scripts/sync-shared.mjs --plugin=andes-core  one plugin only
//   node scripts/sync-shared.mjs --check              report differences, write nothing
//   node scripts/sync-shared.mjs --force              overwrite destination files that carry
//                                                     uncommitted edits
//
// Exit codes: 0 in sync, 10 differences (--check), 2 refused, 1 the script failed.
//
// Files are copied byte for byte: the vendored angular-developer skill is hash-pinned.
// Comparison normalizes line endings, because a Windows checkout holds CRLF.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TREES = { claude: 'claude', copilot: 'copilot' };
export const MIRRORED = ['skills', 'scripts'];

const normalize = (buf) => buf.toString('utf8').replace(/\r\n?/g, '\n');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const subdirs = (p) => (isDir(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);

function walk(abs, rel = '') {
  if (!isDir(abs)) return [];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(abs, e.name), r));
    else out.push(r);
  }
  return out.sort();
}

// One entry per file that differs. `source` and `dest` are repo-relative, forward-slashed.
//   missing: in the source tree only    extra: in the destination tree only    drift: both, different
export function compareMirrors(root, { from = 'claude', plugin } = {}) {
  const to = from === 'claude' ? 'copilot' : 'claude';
  const names = new Set([...subdirs(join(root, TREES[from])), ...subdirs(join(root, TREES[to]))]);
  const diffs = [];
  for (const p of [...names].sort()) {
    if (plugin && p !== plugin) continue;
    for (const folder of MIRRORED) {
      const srcRel = `${TREES[from]}/${p}/${folder}`;
      const dstRel = `${TREES[to]}/${p}/${folder}`;
      const src = walk(join(root, srcRel));
      const dst = new Set(walk(join(root, dstRel)));
      for (const f of src) {
        const entry = { plugin: p, source: `${srcRel}/${f}`, dest: `${dstRel}/${f}` };
        if (!dst.delete(f)) diffs.push({ kind: 'missing', ...entry });
        else if (normalize(readFileSync(join(root, entry.source))) !== normalize(readFileSync(join(root, entry.dest)))) {
          diffs.push({ kind: 'drift', ...entry });
        }
      }
      for (const f of dst) diffs.push({ kind: 'extra', plugin: p, source: `${srcRel}/${f}`, dest: `${dstRel}/${f}` });
    }
  }
  return diffs;
}

// Destination files git reports as modified or untracked; overwriting them would lose work.
function uncommitted(root, tree) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', tree],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(out.split('\0').filter(Boolean).map((l) => l.slice(3)));
  } catch {
    return new Set();
  }
}

function pruneEmpty(abs) {
  if (!isDir(abs)) return;
  for (const e of readdirSync(abs, { withFileTypes: true })) if (e.isDirectory()) pruneEmpty(join(abs, e.name));
  if (!readdirSync(abs).length) rmSync(abs, { recursive: true });
}

function main(argv) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const value = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const from = value('from') ?? 'claude';
  const plugin = value('plugin');
  const check = argv.includes('--check');
  const force = argv.includes('--force');
  const known = argv.every((a) => ['--check', '--force'].includes(a) || /^--(from|plugin)=/.test(a));
  if (!known || !(from in TREES)) {
    console.error('Usage: node scripts/sync-shared.mjs [--from=claude|copilot] [--plugin=<name>] [--check] [--force]');
    return 1;
  }
  const to = from === 'claude' ? 'copilot' : 'claude';
  const diffs = compareMirrors(root, { from, plugin });

  if (check) {
    for (const d of diffs) console.log(`${d.kind.padEnd(7)} ${d.kind === 'extra' ? d.dest : d.source}`);
    console.log(diffs.length ? `${diffs.length} file(s) differ between ${TREES[from]}/ and ${TREES[to]}/.` : 'Mirrors are in sync.');
    return diffs.length ? 10 : 0;
  }

  const dirty = uncommitted(root, TREES[to]);
  const blocked = diffs.filter((d) => d.kind !== 'missing' && dirty.has(d.dest));
  if (blocked.length && !force) {
    console.error(`Refused: these files under ${TREES[to]}/ carry uncommitted edits that the sync would overwrite or delete.`);
    for (const d of blocked) console.error(`  ${d.dest}`);
    console.error(`Sync the other way with --from=${to}, or pass --force to discard them.`);
    return 2;
  }

  for (const d of diffs) {
    if (d.kind === 'extra') rmSync(join(root, d.dest));
    else {
      mkdirSync(dirname(join(root, d.dest)), { recursive: true });
      copyFileSync(join(root, d.source), join(root, d.dest));
    }
    console.log(`${d.kind === 'extra' ? 'removed' : 'copied '} ${d.dest}`);
  }
  if (diffs.some((d) => d.kind === 'extra')) {
    for (const p of subdirs(join(root, TREES[to]))) for (const folder of MIRRORED) pruneEmpty(join(root, TREES[to], p, folder));
  }
  console.log(diffs.length ? `Synced ${diffs.length} file(s) from ${TREES[from]}/ to ${TREES[to]}/.` : 'Mirrors are in sync.');
  return 0;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    console.error(`Sync failed: ${e.message}`);
    process.exitCode = 1;
  }
}
