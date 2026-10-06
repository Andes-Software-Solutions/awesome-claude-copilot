#!/usr/bin/env node
// Runs the script suites once per harness tree, because each tree ships its own copy of the hook
// scripts. Suites for repo-root tooling ignore ANDES_TREE and simply run twice.
//
//   node scripts/tests/run.mjs
//
// Exit codes: 0 every suite passed in every tree, 1 otherwise.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TREES } from '../sync-shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Files are named one by one: `node --test <dir>` fails on Node 22.
const suites = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => join(here, f));

let failed = false;
for (const tree of Object.keys(TREES)) {
  console.log(`\n# ${TREES[tree]}/`);
  const run = spawnSync(process.execPath, ['--test', ...suites], { stdio: 'inherit', env: { ...process.env, ANDES_TREE: tree } });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
