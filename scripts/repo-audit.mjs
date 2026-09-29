#!/usr/bin/env node
// Structural audit for the andes plugin marketplace.
//
// Every plugin under `plugins/` serves Claude Code and GitHub Copilot from one directory:
// shared `skills/` and `scripts/`; Claude Code reads `.claude-plugin/plugin.json`, `.mcp.json`,
// `claude-agents/`, and `claude-hooks/`; Copilot (CLI and cloud agent) reads the Agent Plugins 1.0
// root `plugin.json`, `mcp.json`, and `com.github.copilot/{agents,hooks}/`. This script
// verifies that those pieces still line up, that agents follow the naming/review/MCP
// contracts, that the shared AGENTS.md block matches the template `andes-init` installs,
// that the .NET testing policy has not regressed, and that no Markdown file has a broken local link.
//
//   node scripts/repo-audit.mjs                     human-readable report
//   node scripts/repo-audit.mjs --json              machine-readable report
//   node scripts/repo-audit.mjs --strict            warnings also fail (exit 10)
//   node scripts/repo-audit.mjs --check=a,b         run a subset of checks
//   node scripts/repo-audit.mjs --base=origin/main  also require a version bump for every
//                                                   plugin whose files changed since <base>
//
// Exit codes are the contract that /repo-audit and CI branch on:
//   0  clean (warnings allowed)     10  findings     1  error (the script itself failed)
// Keeping 1 distinct from 10 is what stops a crashed run from being read as "drift".
//
// Line endings are normalized before every comparison (Windows checkouts hold CRLF).
// The script never writes files — detection is deterministic here, judgment is the model's.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

process.on('uncaughtException', (err) => {
  console.error(`Audit failed: ${err.message}`);
  process.exit(1);
});

const CONFIG = {
  pluginsDir: 'plugins',
  namePattern: /^andes-[a-z0-9]+(-[a-z0-9]+)*$/,
  marketplace: '.claude-plugin/marketplace.json',
  // The template andes-init writes into consumer repos; the root AGENTS.md must embed it verbatim.
  agentsTemplate: 'plugins/andes-core/skills/andes-init/assets/agents-block.md',
  agentsBlockBudget: 700,
  skillDescriptionBudget: 400,
  // Characters. Each sits just above the largest file today, so the tree is clean and growth warns.
  skillBodyBudget: 20000,
  agentBodyBudget: 12000,
  agentDescriptionBudget: 550,
  // Folders whose defaults either harness would auto-scan; agents live in claude-agents/ and
  // com.github.copilot/agents/ so neither harness loads the other's files. A legacy
  // .github/plugin manifest would compete with the Agent Plugins root manifest.
  forbiddenPluginDirs: ['agents', 'commands', 'hooks', '.github'],
  copilotAgentsDir: 'com.github.copilot/agents',
  agentPluginsSchema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  agentPluginsMcpSchema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  // Agent Plugins 1.0 fixes component locations; these manifest fields are ignored there.
  agentPluginsForbiddenFields: ['agents', 'skills', 'commands', 'hooks', 'mcpServers', 'lspServers'],
  // Hooks live outside the default `hooks/` for the same reason agents do. Claude Code loads the file
  // its manifest declares; Agent Plugins 1.0 reads hooks only from the com.github.copilot namespace.
  claudeHooksFile: 'claude-hooks/hooks.json',
  copilotHooksFile: 'com.github.copilot/hooks/hooks.json',
  // Each Claude event must run the same scripts as its Copilot counterpart.
  hookEventMap: { Notification: 'notification', Stop: 'agentStop', PostToolUse: 'postToolUse' },
  hookScriptRef: {
    claude: /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+\.mjs)/g,
    bash: /\$PLUGIN_ROOT\/scripts\/([\w.-]+\.mjs)/g,
    powershell: /\$env:PLUGIN_ROOT\/scripts\/([\w.-]+\.mjs)/g,
  },
  // Claude Code's main session implements code, so these roles exist only for Copilot.
  copilotOnlyAgents: [
    'andes-planner-expert', 'andes-full-stack-expert', 'andes-csharp-expert',
    'andes-angular-expert', 'andes-csharp-dotnet-janitor',
  ],
  // Copilot agents that implement and therefore carry the "## Review loop" section of AGENTS.md
  // verbatim (Copilot subagents do not receive AGENTS.md).
  loopAgents: [
    'andes-csharp-expert', 'andes-angular-expert', 'andes-csharp-dotnet-janitor', 'andes-full-stack-expert',
  ],
  // Reviewers find defects, so they keep the deepest effort; everything else runs at high.
  effort: { reviewer: 'xhigh', other: 'high' },
  // A higher level consumes more AI Credits, so Copilot effort is tiered by role instead of mirroring
  // the Claude pins. null means the key must be absent: the model has no configurable reasoning.
  copilotEffort: {
    'andes-csharp-code-reviewer': 'high',
    'andes-angular-code-reviewer': 'high',
    'andes-github-actions-reviewer': 'high',
    'andes-prd-generator': 'high',
    'andes-planner-expert': 'high',
    'andes-full-stack-expert': 'medium',
    'andes-csharp-expert': 'medium',
    'andes-angular-expert': 'medium',
    'andes-csharp-dotnet-janitor': 'medium',
    'andes-ado-backlog-manager': 'medium',
    'andes-se-technical-writer': null,
  },
  // The CLI reference documents this spelling, but Copilot CLI 1.0.88 only reads the kebab-case key
  // (github/copilot-cli#4963).
  copilotEffortMisspelling: 'reasoningEffort',
  // Copilot pins list the CLI slug, then the VS Code display name. Copilot CLI 1.0.89 dispatches
  // on the first entry only and fails the dispatch when it is unavailable; VS Code tries each in order.
  modelParity: {
    sonnet: ['claude-sonnet-5.5', 'Claude Sonnet 5.5 (copilot)'],
    haiku: ['claude-haiku-4.5', 'Claude Haiku 4.5 (copilot)'],
    opus: ['claude-opus-5.5', 'Claude Opus 5.5 (copilot)'],
    fable: ['claude-fable-5.1', 'Claude Fable 5.1 (copilot)'],
  },
  // Documented per-harness cost overrides. Each states the Claude model it was recorded
  // against so it goes stale loudly instead of silently excusing a future model change.
  modelParityOverrides: {
    'andes-github-actions-reviewer': {
      claude: 'opus',
      copilot: ['claude-sonnet-5.5', 'Claude Sonnet 5.5 (copilot)'],
      reason: 'deliberate: deepest review tier on Claude; Opus pricing not justified on Copilot AI Credits',
    },
    'andes-se-technical-writer': {
      claude: 'sonnet',
      copilot: ['claude-haiku-4.5', 'Claude Haiku 4.5 (copilot)'],
      reason: 'template-driven docs; ~2x cheaper on AI Credits; Haiku 4.5 has no configurable reasoning',
    },
  },
  // Copilot agents declare no target, which GitHub defines as both vscode and github-copilot. One
  // frontmatter shape serves both, so keys and tool-set ids that only VS Code honors stay forbidden.
  copilotToolAliases: ['read', 'edit', 'search', 'execute', 'agent', 'web', 'todo'],
  copilotVscodeOnlyKeys: ['handoffs', 'argument-hint'],
  // VS Code Local sessions render handoffs as buttons; Copilot CLI and the cloud agent ignore the key.
  // Only the planner keeps them, as a bridge to the implementer until VS Code runs the CLI harness.
  copilotHandoffAgents: ['andes-planner-expert'],
  copilotBuiltinHandoffTargets: ['agent'],
  // MCP tools each research or implementer agent must be granted, in Copilot `server/tool` form.
  // A Claude twin is checked through the plugin that ships the server. This is what guarantees the
  // planner and the writers ground version-specific answers in the right server, not in memory.
  requiredMcpGrants: {
    'andes-planner-expert': [
      'microsoft-learn/microsoft_docs_search', 'microsoft-learn/microsoft_docs_fetch',
      'angular-cli/get_best_practices', 'angular-cli/search_documentation',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    'andes-prd-generator': [
      'microsoft-learn/microsoft_docs_search', 'microsoft-learn/microsoft_docs_fetch',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    'andes-se-technical-writer': [
      'microsoft-learn/microsoft_docs_search', 'microsoft-learn/microsoft_docs_fetch',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    'andes-csharp-expert': [
      'microsoft-learn/microsoft_docs_search', 'microsoft-learn/microsoft_code_sample_search', 'microsoft-learn/microsoft_docs_fetch',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    'andes-csharp-dotnet-janitor': [
      'microsoft-learn/microsoft_docs_search', 'microsoft-learn/microsoft_code_sample_search', 'microsoft-learn/microsoft_docs_fetch',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    'andes-angular-expert': [
      'angular-cli/get_best_practices', 'angular-cli/search_documentation', 'angular-cli/find_examples',
      'context7/resolve-library-id', 'context7/query-docs',
    ],
    // The backlog manager writes to Azure DevOps; without these it can only report.
    'andes-ado-backlog-manager': [
      'azure-devops/wit_work_item', 'azure-devops/wit_query', 'azure-devops/wit_work_item_write',
      'azure-devops/wit_work_item_link_write', 'azure-devops/work', 'azure-devops/core_list_project_teams',
    ],
  },
  // npx servers that deliberately float instead of pinning; the package must carry exactly this
  // suffix so the MCP tool set tracks the latest CLI release.
  floatingMcpServers: { 'angular-cli': '@latest' },
  requiredMcpArgs: {
    'angular-cli': ['--read-only'],
    terraform: ['--toolsets=registry'],
    // Three domains and az-login auth only: no test plans, repos, pipelines, wiki, or search, and no
    // interactive sign-in a headless subagent could never complete.
    'azure-devops': ['-d', 'core', 'work', 'work-items', '--authentication', 'azcli'],
  },
  // `-d` is additive, so requiredMcpArgs alone cannot stop a domain being re-enabled.
  forbiddenMcpArgs: { 'azure-devops': ['all', 'test-plans', 'repositories', 'pipelines', 'wiki', 'search', 'advanced-security'] },
  // Exposed by a shipped server but never granted to an agent.
  forbiddenMcpTools: ['ai_tutor', 'wit_work_item_attachment', 'work_iteration_write', 'work_capacity_write'],
  // This repo never installs its own plugins, so the root .mcp.json starts the servers maintainers
  // query; each entry must match the plugin that ships it so the pins move together.
  maintainerMcpServers: ['microsoft-learn', 'angular-cli', 'context7', 'azure-devops', 'terraform'],
  // Skills whose bytes are pinned to an upstream source and must not be edited here.
  upstreamLock: 'scripts/upstream-skills.lock.json',
  // The link checker the andes-core hook runs; the audit reuses it so CI and the hook agree.
  linkChecker: 'plugins/andes-core/scripts/check-links.mjs',
  // Consumer templates: their links resolve in the repo andes-init writes them into.
  linkCheckExclude: ['plugins/andes-core/skills/andes-init/assets/'],
  // Paths that only exist in the old drop-in layout; plugin content must name skills instead.
  harnessPathPattern: /\.claude\/(rules|skills|agents|CLAUDE\.md)|\.github\/(skills|instructions|agents|copilot-instructions\.md)|copilot-instructions\.md/,
  // andes-init detects and removes the old drop-in layout, so it must name those paths.
  harnessPathAllow: ['plugins/andes-core/skills/andes-init/'],
  bannedTestLibs: /\b(FluentAssertions|AwesomeAssertions|Shouldly|Moq|FakeItEasy|NUnit|MSTest|UseInMemoryDatabase)\b|fluent assertions/i,
  // C# non-negotiables: Minimal APIs and FluentValidation only, no repository layer, sync Add/AddRange. Lines phrased as prohibitions pass.
  bannedCsharpPatterns: /\[ApiController\]|AddControllers\(|MapControllers\(|DataAnnotationsValidator|DataAnnotations|--use-controllers|\bAdd(Range)?Async\b|\b[A-Z]\w+Repository\b|<Entity>Repository/,
  policyLine: /\b(never|not|no|don't|banned|instead of|last resort|avoid|only|flag)\b/i,
  textExt: /\.(md|json|mjs|js|ts|yml|yaml)$/,
};

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const STRICT = args.includes('--strict');
const onlyArg = args.find((a) => a.startsWith('--check='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--check='.length).split(',')) : null;
const baseArg = args.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length) : null;
const runs = (name) => !ONLY || ONLY.has(name);

const findings = [];
function add(check, id, severity, message, paths, detail, fixHint) {
  findings.push({
    check, id: `${check}/${id}`, severity, message, paths,
    ...(detail ? { detail } : {}), ...(fixHint ? { fixHint } : {}),
  });
}

const norm = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s).replace(/\r\n?/g, '\n');
const exists = (rel) => existsSync(join(ROOT, rel));
const isDir = (rel) => exists(rel) && statSync(join(ROOT, rel)).isDirectory();
const read = (rel) => norm(readFileSync(join(ROOT, rel), 'utf8'));
const readJson = (rel) => {
  try { return JSON.parse(read(rel)); } catch (e) { throw new Error(`${rel}: invalid JSON (${e.message})`); }
};
const sha = (s) => createHash('sha256').update(s).digest('hex');
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const stripQuotes = (v) =>
  (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;
const dirs = (rel) => (isDir(rel) ? readdirSync(join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);
const files = (rel, suffix) => (isDir(rel) ? readdirSync(join(ROOT, rel)).filter((f) => f.endsWith(suffix)).sort() : []);

function walkFiles(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walkFiles(rel));
    else out.push(rel);
  }
  return out;
}

// Minimal frontmatter access: top-level scalars, block lists, and (possibly multi-line)
// flow lists — which covers every key the agents and skills here use.
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: '', body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}
function fmScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'));
  return m ? stripQuotes(m[1].trim()) : null;
}
function fmList(fm, key) {
  const lines = fm.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return null;
  let rest = lines[i].slice(key.length + 1).trim();
  let start = i + 1;
  // Prettier-style flow lists open on the line after the key.
  if (!rest && lines[i + 1]?.trim().startsWith('[')) { rest = lines[i + 1].trim(); start = i + 2; }
  if (rest.startsWith('[')) {
    let buf = rest;
    for (let j = start; !buf.includes(']') && j < lines.length; j++) buf += lines[j];
    return buf.slice(buf.indexOf('[') + 1, buf.lastIndexOf(']')).split(',')
      .map((s) => stripQuotes(s.trim())).filter(Boolean);
  }
  if (rest) return rest.split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
  const items = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^\s+-\s*(.+)$/);
    if (!m) break;
    items.push(stripQuotes(m[1].trim()));
  }
  return items;
}
const hasKey = (fm, key) => new RegExp(`^${key}:`, 'm').test(fm);
function handoffTargets(fm) {
  const lines = fm.split('\n');
  const i = lines.findIndex((l) => l.startsWith('handoffs:'));
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < lines.length && /^\s/.test(lines[j]); j++) {
    const m = lines[j].match(/^\s+(?:-\s+)?agent:\s*(.+)$/);
    if (m) out.push(stripQuotes(m[1].trim()));
  }
  return out;
}
function section(body, heading) {
  const lines = body.split('\n');
  const i = lines.findIndex((l) => l.trim() === heading);
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^#{1,2} /.test(lines[j]) && !lines[j].startsWith('<!-- andes:end')) j++;
  return lines.slice(i + 1, j).join('\n').trim();
}

const plugins = dirs(CONFIG.pluginsDir);
const P = (name) => `${CONFIG.pluginsDir}/${name}`;
const stats = { plugins: plugins.length, skills: 0, claudeAgents: 0, copilotAgents: 0, agentTwins: 0 };

// Collected once; several checks read the agent inventory.
const agents = [];
for (const p of plugins) {
  for (const f of files(`${P(p)}/claude-agents`, '.md')) {
    const path = `${P(p)}/claude-agents/${f}`;
    agents.push({ plugin: p, harness: 'claude', stem: f.slice(0, -3), path, ...splitFrontmatter(read(path)) });
  }
  for (const f of files(`${P(p)}/${CONFIG.copilotAgentsDir}`, '.agent.md')) {
    const path = `${P(p)}/${CONFIG.copilotAgentsDir}/${f}`;
    agents.push({ plugin: p, harness: 'copilot', stem: f.slice(0, -'.agent.md'.length), path, ...splitFrontmatter(read(path)) });
  }
}
const isReviewer = (a) => a.stem.endsWith('-reviewer');

// --- manifests ---------------------------------------------------------------
if (runs('manifests')) {
  const seen = new Map();
  for (const p of plugins) {
    const cPath = `${P(p)}/.claude-plugin/plugin.json`;
    const gPath = `${P(p)}/plugin.json`;
    if (!CONFIG.namePattern.test(p)) {
      add('manifests', 'name-pattern', 'error', `Plugin folder '${p}' does not match ${CONFIG.namePattern}`, [P(p)]);
    }
    for (const d of CONFIG.forbiddenPluginDirs) {
      if (isDir(`${P(p)}/${d}`)) {
        add('manifests', 'default-dir', 'error', `Plugin has a default-named '${d}/' folder that one harness would auto-load for the other`,
          [`${P(p)}/${d}`], undefined, 'Use claude-agents/ (listed in .claude-plugin/plugin.json) and com.github.copilot/agents/ instead.');
      }
    }
    const missing = [cPath, gPath].filter((x) => !exists(x));
    if (missing.length) {
      add('manifests', 'missing', 'error', 'Plugin is missing a harness manifest', missing);
      continue;
    }
    const c = readJson(cPath);
    const g = readJson(gPath);
    seen.set(p, c.version);
    for (const [label, m, path] of [['claude', c, cPath], ['copilot', g, gPath]]) {
      if (m.name !== p) add('manifests', 'name-mismatch', 'error', `${label} manifest name '${m.name}' is not the folder name '${p}'`, [path]);
      if (!/^\d+\.\d+\.\d+$/.test(m.version ?? '')) add('manifests', 'semver', 'error', `${label} manifest version '${m.version}' is not x.y.z`, [path]);
    }
    for (const key of ['version', 'description']) {
      if (c[key] !== g[key]) add('manifests', `${key}-drift`, 'error', `Manifests disagree on '${key}'`, [cPath, gPath], { claude: c[key], copilot: g[key] });
    }
    const listed = (c.agents ?? []).map((a) => a.replace(/^\.\//, ''));
    const onDisk = files(`${P(p)}/claude-agents`, '.md').map((f) => `claude-agents/${f}`);
    for (const a of onDisk) if (!listed.includes(a)) add('manifests', 'claude-agent-unlisted', 'error', `Claude agent '${a}' is not listed in plugin.json "agents" (Claude loads only listed files)`, [cPath, `${P(p)}/${a}`]);
    for (const a of listed) if (!onDisk.includes(a)) add('manifests', 'claude-agent-ghost', 'error', `plugin.json lists '${a}' but the file does not exist`, [cPath]);
    if (g.$schema !== CONFIG.agentPluginsSchema) {
      add('manifests', 'agent-plugins-schema', 'error', `Copilot manifest must declare $schema ${CONFIG.agentPluginsSchema} (VS Code and Copilot CLI then use Agent Plugins 1.0 semantics)`, [gPath]);
    }
    for (const k of CONFIG.agentPluginsForbiddenFields) {
      if (k in g) add('manifests', 'agent-plugins-field', 'error', `Agent Plugins 1.0 manifests have fixed component locations; remove '${k}'`, [gPath]);
    }
    for (const dep of c.dependencies ?? []) {
      const depName = typeof dep === 'string' ? dep.split('@')[0] : dep.name;
      if (!plugins.includes(depName)) add('manifests', 'dependency-ghost', 'error', `Dependency '${depName}' is not a plugin in this marketplace`, [cPath]);
    }
  }

  if (!exists(CONFIG.marketplace)) {
    add('manifests', 'marketplace-missing', 'error', 'Marketplace manifest is missing', [CONFIG.marketplace]);
  } else {
    const m = readJson(CONFIG.marketplace);
    const entries = m.plugins ?? [];
    for (const p of plugins) {
      const hits = entries.filter((e) => e.name === p);
      if (hits.length !== 1) add('manifests', 'marketplace-entry', 'error', `Marketplace lists '${p}' ${hits.length} times (expected once)`, [CONFIG.marketplace]);
      else if (hits[0].source !== `./${P(p)}`) add('manifests', 'marketplace-source', 'error', `Marketplace source for '${p}' should be './${P(p)}'`, [CONFIG.marketplace], { source: hits[0].source });
    }
    for (const e of entries) if (!plugins.includes(e.name)) add('manifests', 'marketplace-ghost', 'error', `Marketplace lists '${e.name}' but no plugin folder exists`, [CONFIG.marketplace]);
  }

  if (BASE) {
    // stderr is dropped: `git show` on a plugin that did not exist at the merge base is expected noise.
    const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const mergeBase = git('merge-base', BASE, 'HEAD').trim();
    const changed = git('diff', '--name-only', mergeBase, '--', CONFIG.pluginsDir).split('\n').filter(Boolean);
    for (const p of plugins) {
      if (!changed.some((f) => f.startsWith(`${P(p)}/`))) continue;
      let before;
      try { before = JSON.parse(git('show', `${mergeBase}:${P(p)}/.claude-plugin/plugin.json`)).version; } catch { continue; }
      if (before === seen.get(p)) {
        add('manifests', 'version-bump', 'error', `'${p}' changed since ${BASE} but its version is still ${before} — installed copies are cached by version and will not update`,
          [`${P(p)}/.claude-plugin/plugin.json`, `${P(p)}/plugin.json`], undefined, 'Bump the version in both manifests.');
      }
    }
  }
}

// --- skills ------------------------------------------------------------------
if (runs('skills')) {
  const owners = new Map();
  for (const p of plugins) {
    for (const s of dirs(`${P(p)}/skills`)) {
      stats.skills++;
      const path = `${P(p)}/skills/${s}/SKILL.md`;
      if (!exists(path)) { add('skills', 'missing-skill-md', 'error', `Skill folder '${s}' has no SKILL.md`, [`${P(p)}/skills/${s}`]); continue; }
      const { fm, body } = splitFrontmatter(read(path));
      const name = fmScalar(fm, 'name');
      const desc = fmScalar(fm, 'description');
      if (body.length > CONFIG.skillBodyBudget) {
        add('skills', 'body-budget', 'warn', `SKILL.md body is ${body.length} chars (budget ${CONFIG.skillBodyBudget}); move detail into references/ so it loads on demand`, [path]);
      }
      if (name !== s) add('skills', 'name-mismatch', 'error', `Skill name '${name}' does not match its folder '${s}'`, [path]);
      if (!desc) add('skills', 'no-description', 'error', 'Skill has no description — it can never trigger on its own', [path]);
      else if (desc.length > CONFIG.skillDescriptionBudget) {
        add('skills', 'description-budget', 'warn', `Description is ${desc.length} chars (budget ${CONFIG.skillDescriptionBudget}); every installed skill description is always in context`, [path]);
      }
      for (const k of ['paths', 'applyTo']) {
        if (hasKey(fm, k)) add('skills', 'rule-frontmatter', 'error', `SKILL.md still carries rule frontmatter '${k}:' (plugins cannot ship path-scoped rules)`, [path]);
      }
      if (fmScalar(fm, 'disable-model-invocation') === 'true') {
        add('skills', 'cli-unreachable', 'error', "'disable-model-invocation: true' makes a skill unreachable on Copilot CLI (github/copilot-cli#4438); guard in the body instead", [path]);
      }
      if (!owners.has(s)) owners.set(s, []);
      owners.get(s).push(p);
    }
  }
  for (const [s, ps] of owners) {
    if (ps.length > 1) add('skills', 'duplicate-name', 'error', `Skill '${s}' is defined in several plugins: ${ps.join(', ')}`, ps.map((p) => `${P(p)}/skills/${s}`));
  }

  if (exists(CONFIG.upstreamLock)) {
    const lock = readJson(CONFIG.upstreamLock);
    for (const [s, entry] of Object.entries(lock.skills ?? {})) {
      const dir = entry.andes?.path;
      if (!dir || !isDir(dir)) { add('skills', 'upstream-path', 'error', `Upstream-pinned skill '${s}' has no andes.path in the lock, or the folder is missing`, [CONFIG.upstreamLock]); continue; }
      const tree = walkFiles(dir).sort().map((f) => `${f.slice(dir.length + 1)}\n${sha(read(f))}`).join('\n');
      if (sha(tree) !== entry.andes.treeSha256) {
        add('skills', 'upstream-drift', 'error', `Upstream-pinned skill '${s}' was edited locally (tree hash mismatch)`, [dir, CONFIG.upstreamLock],
          { expected: entry.andes.treeSha256, actual: sha(tree) }, 'Revert the local edit, or re-vendor from upstream and update treeSha256.');
      }
    }
  }
}

// --- harness-paths -----------------------------------------------------------
if (runs('harness-paths')) {
  for (const f of walkFiles(CONFIG.pluginsDir)) {
    if (!CONFIG.textExt.test(f) || CONFIG.harnessPathAllow.some((a) => f.startsWith(a))) continue;
    read(f).split('\n').forEach((line, i) => {
      if (CONFIG.harnessPathPattern.test(line)) {
        add('harness-paths', 'drop-in-path', 'error', 'Plugin content references a drop-in-tree path that does not exist once installed', [`${f}:${i + 1}`],
          { line: line.trim().slice(0, 200) }, 'Refer to the skill or agent by name instead.');
      }
    });
  }
}

// --- agents ------------------------------------------------------------------
if (runs('agents')) {
  // server name → plugin that ships it; drives the mcp-wildcard, mcp-owner, and required-mcp rules.
  const mcpOwners = new Map(plugins.flatMap((p) => (exists(`${P(p)}/.mcp.json`) ? Object.keys(readJson(`${P(p)}/.mcp.json`).mcpServers ?? {}).map((s) => [s, p]) : [])));
  const aliasSubtool = new RegExp(`^(${CONFIG.copilotToolAliases.join('|')})/`);
  const normDesc = (d) => (d ?? '').replace(/\bUse PROACTIVELY\b/g, 'Use').replace(/\s+/g, ' ').trim();

  for (const a of agents) {
    if (a.harness === 'claude') stats.claudeAgents++; else stats.copilotAgents++;
    const name = fmScalar(a.fm, 'name');
    const tools = fmList(a.fm, 'tools') ?? [];
    if (name !== a.stem) add('agents', 'name-stem', 'error', `Agent name '${name}' must equal its file stem '${a.stem}'`, [a.path]);
    if (!CONFIG.namePattern.test(a.stem)) add('agents', 'name-pattern', 'error', `Agent '${a.stem}' must match ${CONFIG.namePattern}`, [a.path]);
    if (!fmScalar(a.fm, 'model')) add('agents', 'model-pin', 'error', 'Agent does not pin a model', [a.path]);
    const desc = fmScalar(a.fm, 'description');
    if (!desc) add('agents', 'no-description', 'error', 'Agent has no description', [a.path]);
    else if (desc.length > CONFIG.agentDescriptionBudget) {
      add('agents', 'description-budget', 'warn', `Description is ${desc.length} chars (budget ${CONFIG.agentDescriptionBudget}); every installed agent description is always in context`, [a.path]);
    }
    if (a.body.length > CONFIG.agentBodyBudget) {
      add('agents', 'body-budget', 'warn', `Agent body is ${a.body.length} chars (budget ${CONFIG.agentBodyBudget}); it is paid on every run of the agent`, [a.path]);
    }

    for (const t of tools) {
      if (t.endsWith('*') || (a.harness === 'claude' ? t.startsWith('mcp__') && !t.slice(5).includes('__') : mcpOwners.has(t))) {
        add('agents', 'mcp-wildcard', 'error', `Tool grant '${t}' exposes a whole server or toolset; list exact tools`, [a.path]);
      }
      if (CONFIG.forbiddenMcpTools.some((f) => t.endsWith(`__${f}`) || t.endsWith(`/${f}`))) {
        add('agents', 'forbidden-tool', 'error', `Agent is granted '${t}'`, [a.path]);
      }
    }

    if (a.harness === 'claude') {
      const effort = fmScalar(a.fm, 'effort');
      const want = isReviewer(a) ? CONFIG.effort.reviewer : CONFIG.effort.other;
      if (effort !== want) add('agents', 'effort', 'error', `Claude agent effort is '${effort}', expected '${want}'`, [a.path]);
      for (const t of tools) {
        const m = t.match(/^mcp__plugin_([^_]+)_([^_]+)__/);
        if (m && mcpOwners.get(m[2]) !== m[1]) {
          add('agents', 'mcp-owner', 'error', `Tool '${t}' names plugin '${m[1]}', but server '${m[2]}' is shipped by '${mcpOwners.get(m[2]) ?? 'no plugin'}'`, [a.path]);
        }
      }
      for (const req of CONFIG.requiredMcpGrants[a.stem] ?? []) {
        const [server, toolName] = req.split('/');
        const want = `mcp__plugin_${mcpOwners.get(server)}_${server}__${toolName}`;
        if (!tools.includes(want)) add('agents', 'required-mcp', 'error', `Agent must be granted '${want}'`, [a.path]);
      }
    }

    if (isReviewer(a)) {
      if (hasKey(a.fm, 'agents')) add('agents', 'reviewer-agents', 'error', 'Reviewer declares agents: — reviewers never invoke other agents', [a.path]);
      const writeTools = a.harness === 'claude' ? ['Write', 'Edit', 'NotebookEdit', 'Agent', 'Task'] : ['edit', 'agent'];
      for (const t of tools) {
        if (writeTools.includes(t) || writeTools.some((w) => t.startsWith(`${w}/`))) {
          add('agents', 'reviewer-write', 'error', `Reviewer is granted '${t}'`, [a.path]);
        }
      }
      if (a.harness === 'claude') {
        const denied = fmList(a.fm, 'disallowedTools') ?? [];
        for (const t of ['Write', 'Edit', 'NotebookEdit', 'Agent']) {
          if (!denied.includes(t)) add('agents', 'reviewer-disallow', 'error', `Reviewer must list '${t}' in disallowedTools`, [a.path]);
        }
      }
      if (!/\*\*High\*\*/.test(a.body) || !/\*\*Medium\*\*/.test(a.body) || /\*\*(Critical|Low)\*\*/.test(a.body)) {
        add('agents', 'reviewer-severity', 'error', 'Reviewer must report exactly two severities: **High** and **Medium**', [a.path]);
      }
    }

    if (a.harness === 'copilot') {
      if (hasKey(a.fm, 'target')) {
        add('agents', 'target', 'error', "Copilot agent declares 'target:', which limits it to one environment; remove the key so it loads in both VS Code and github-copilot", [a.path]);
      }
      for (const k of CONFIG.copilotVscodeOnlyKeys) {
        if (k === 'handoffs' && CONFIG.copilotHandoffAgents.includes(a.stem)) continue;
        if (hasKey(a.fm, k)) add('agents', 'vscode-key', 'error', `'${k}:' is VS Code-only frontmatter, unsupported on Copilot CLI and the cloud agent; remove it`, [a.path]);
      }
      if (hasKey(a.fm, CONFIG.copilotEffortMisspelling)) {
        add('agents', 'effort-key', 'error', `'${CONFIG.copilotEffortMisspelling}:' is not applied by Copilot CLI; use 'reasoning-effort:'`, [a.path]);
      }
      const effort = fmScalar(a.fm, 'reasoning-effort');
      if (!(a.stem in CONFIG.copilotEffort)) {
        add('agents', 'effort', 'error', 'Copilot agent has no copilotEffort entry', [a.path, 'scripts/repo-audit.mjs']);
      } else if (effort !== CONFIG.copilotEffort[a.stem]) {
        const want = CONFIG.copilotEffort[a.stem];
        add('agents', 'effort', 'error', want
          ? `Copilot agent reasoning-effort is '${effort}', expected '${want}'`
          : `Copilot agent declares reasoning-effort '${effort}', but its model has no configurable reasoning; remove the key`, [a.path]);
      }
      const pin = (fmList(a.fm, 'model') ?? []).join(', ');
      const knownPins = [...Object.values(CONFIG.modelParity), ...Object.values(CONFIG.modelParityOverrides).map((o) => o.copilot)];
      if (!knownPins.some((p) => p.join(', ') === pin)) {
        add('agents', 'model-format', 'error', `Copilot agent pins '[${pin}]'; pin a modelParity pair [<cli-slug>, <Display Name> (copilot)] so Copilot CLI and VS Code both resolve it`, [a.path, 'scripts/repo-audit.mjs']);
      }
      for (const t of tools) {
        if (t.startsWith('vscode/')) add('agents', 'vscode-tool', 'error', `'${t}' is a VS Code-only tool with no equivalent on Copilot CLI or the cloud agent`, [a.path]);
        else if (aliasSubtool.test(t)) add('agents', 'alias-subtool', 'error', `'${t}' is a VS Code tool-set member; grant the plain alias '${t.split('/')[0]}'`, [a.path]);
      }
      const subagents = fmList(a.fm, 'agents') ?? [];
      if ((subagents.length > 0) !== tools.includes('agent')) {
        add('agents', 'agent-tool-mismatch', 'error', subagents.length
          ? "'agents:' lists subagents but the 'agent' tool is not granted, so the agent cannot delegate"
          : "the 'agent' tool is granted without an 'agents:' allowlist", [a.path]);
      }
      for (const t of subagents) {
        const target = agents.find((x) => x.harness === 'copilot' && x.stem === t);
        if (!target) add('agents', 'target-ghost', 'error', `Agent references '${t}', which is not a Copilot agent in this marketplace`, [a.path]);
        else if (fmScalar(target.fm, 'disable-model-invocation') === 'true') {
          add('agents', 'target-not-invocable', 'error', `'${t}' declares disable-model-invocation: true and cannot be invoked as a subagent`, [a.path, target.path]);
        }
      }
      // The user clicks a handoff, so disable-model-invocation on its target does not matter.
      for (const t of handoffTargets(a.fm)) {
        if (!CONFIG.copilotBuiltinHandoffTargets.includes(t) && !agents.some((x) => x.harness === 'copilot' && x.stem === t)) {
          add('agents', 'target-ghost', 'error', `Handoff targets '${t}', which is not a Copilot agent in this marketplace or a built-in VS Code agent`, [a.path]);
        }
      }
      for (const req of CONFIG.requiredMcpGrants[a.stem] ?? []) {
        if (!tools.includes(req)) add('agents', 'required-mcp', 'error', `Agent must be granted '${req}'`, [a.path]);
      }
    }
  }

  for (const a of agents.filter((x) => x.harness === 'copilot')) {
    const twin = agents.find((x) => x.harness === 'claude' && x.stem === a.stem);
    if (!twin) {
      if (!CONFIG.copilotOnlyAgents.includes(a.stem)) {
        add('agents', 'missing-claude-twin', 'error', 'Copilot agent has no Claude twin and is not listed in copilotOnlyAgents', [a.path]);
      }
      continue;
    }
    if (twin.plugin !== a.plugin) add('agents', 'twin-plugin', 'error', 'Agent twins live in different plugins', [twin.path, a.path]);
    stats.agentTwins++;
    if (normDesc(fmScalar(twin.fm, 'description')) !== normDesc(fmScalar(a.fm, 'description'))) {
      add('agents', 'description-parity', 'error', 'Twin descriptions differ beyond the word PROACTIVELY (the description drives auto-delegation on both harnesses)', [twin.path, a.path]);
    }
    const cModel = fmScalar(twin.fm, 'model');
    const gModel = (fmList(a.fm, 'model') ?? []).join(', ');
    const override = CONFIG.modelParityOverrides[a.stem];
    if (override && override.claude !== cModel) {
      add('agents', 'model-parity', 'error', `Stale override: recorded against Claude model '${override.claude}' but the agent now pins '${cModel}'`,
        [twin.path, 'scripts/repo-audit.mjs'], undefined, 'Update or remove the modelParityOverrides entry.');
      continue;
    }
    const expected = (override ? override.copilot : CONFIG.modelParity[cModel])?.join(', ');
    if (!expected) add('agents', 'unknown-model', 'warn', `Claude model '${cModel}' has no modelParity entry`, [twin.path]);
    else if (gModel !== expected) {
      add('agents', 'model-parity', 'error', `Copilot twin pins '[${gModel}]' but parity expects '[${expected}]'`, [twin.path, a.path],
        override ? { override } : undefined, 'Align the model, or record a documented override (user approval required).');
    }
  }
  for (const a of agents.filter((x) => x.harness === 'claude')) {
    if (!agents.some((x) => x.harness === 'copilot' && x.stem === a.stem)) {
      add('agents', 'missing-copilot-twin', 'error', 'Claude agent has no Copilot twin', [a.path]);
    }
  }
}

// --- mcp ---------------------------------------------------------------------
if (runs('mcp')) {
  if (exists('.vscode/mcp.json')) add('mcp', 'root-config', 'error', 'This repo is maintained with Claude Code; its MCP servers live in the root .mcp.json', ['.vscode/mcp.json']);
  const rootServers = exists('.mcp.json') ? readJson('.mcp.json').mcpServers ?? {} : {};
  for (const name of CONFIG.maintainerMcpServers) {
    const owner = plugins.find((p) => (exists(`${P(p)}/.mcp.json`) ? readJson(`${P(p)}/.mcp.json`).mcpServers ?? {} : {})[name]);
    const shipped = owner && readJson(`${P(owner)}/.mcp.json`).mcpServers[name];
    if (!rootServers[name]) add('mcp', 'root-missing', 'error', `The root .mcp.json does not start '${name}'`, ['.mcp.json']);
    else if (!shipped) add('mcp', 'root-drift', 'error', `No plugin ships '${name}'; drop it from maintainerMcpServers or the root .mcp.json`, ['.mcp.json']);
    else if (JSON.stringify(rootServers[name]) !== JSON.stringify(shipped)) {
      add('mcp', 'root-drift', 'error', `Root .mcp.json '${name}' differs from ${P(owner)}/.mcp.json`, ['.mcp.json', `${P(owner)}/.mcp.json`], { root: rootServers[name], plugin: shipped });
    }
  }
  for (const p of plugins) {
    const path = `${P(p)}/.mcp.json`;
    if (!exists(path)) continue;
    const apPath = `${P(p)}/mcp.json`;
    if (!exists(apPath)) {
      add('mcp', 'copilot-missing', 'error', 'Plugin ships .mcp.json (Claude Code) but no mcp.json (Agent Plugins, Copilot)', [path]);
    } else {
      const ap = readJson(apPath);
      if (ap.$schema !== CONFIG.agentPluginsMcpSchema || Object.keys(ap).some((k) => !['$schema', 'mcpServers'].includes(k))) {
        add('mcp', 'agent-plugins-schema', 'error', `mcp.json must hold only $schema (${CONFIG.agentPluginsMcpSchema}) and mcpServers`, [apPath]);
      }
      const claudeServers = readJson(path).mcpServers ?? {};
      const apServers = ap.mcpServers ?? {};
      const names = new Set([...Object.keys(claudeServers), ...Object.keys(apServers)]);
      for (const n of names) {
        const c = claudeServers[n];
        const a = apServers[n];
        const meta = (s) => JSON.stringify([s?.headers ?? null, s?.env ?? null]);
        const same = c && a && meta(c) === meta(a) && (a.type === 'streamable-http' || a.type === 'sse'
          ? c.type === 'http' && c.url === a.url
          : a.type === 'stdio' && c.command === a.command && JSON.stringify(c.args ?? []) === JSON.stringify(a.args ?? []));
        if (!same) add('mcp', 'harness-drift', 'error', `Server '${n}' differs between .mcp.json and mcp.json`, [path, apPath], { claude: c, copilot: a });
      }
    }
    for (const [name, s] of Object.entries(readJson(path).mcpServers ?? {})) {
      const argv = s.args ?? [];
      if (s.command === 'npx') {
        const pkg = argv.find((x) => !x.startsWith('-'));
        const floating = CONFIG.floatingMcpServers[name];
        if (floating) {
          if (!pkg?.endsWith(floating)) add('mcp', 'floating-suffix', 'error', `npx server '${name}' must float with '${floating}'`, [path], { pkg });
        } else if (!pkg || !/@\d/.test(pkg.replace(/^@/, ''))) {
          add('mcp', 'unpinned', 'error', `npx server '${name}' is not version-pinned`, [path], { pkg });
        }
      }
      if (s.command === 'docker') {
        const image = argv.find((x) => x.includes('/') && !x.startsWith('-'));
        if (!image || !image.includes(':')) add('mcp', 'unpinned', 'error', `docker server '${name}' has no image tag`, [path], { image });
      }
      for (const req of CONFIG.requiredMcpArgs[name] ?? []) {
        if (!argv.includes(req)) add('mcp', 'required-arg', 'error', `Server '${name}' must run with '${req}'`, [path]);
      }
      for (const bad of CONFIG.forbiddenMcpArgs[name] ?? []) {
        if (argv.includes(bad)) add('mcp', 'forbidden-arg', 'error', `Server '${name}' must not run with '${bad}'`, [path]);
      }
    }
  }
}

// --- hooks -------------------------------------------------------------------
if (runs('hooks')) {
  const refs = (text, re) => [...String(text ?? '').matchAll(re)].map((m) => m[1]);
  const sorted = (xs) => [...new Set(xs)].sort();
  for (const p of plugins) {
    const cPath = `${P(p)}/.claude-plugin/plugin.json`;
    if (!exists(cPath)) continue;
    const declared = readJson(cPath).hooks;
    const claudePath = `${P(p)}/${CONFIG.claudeHooksFile}`;
    const copilotPath = `${P(p)}/${CONFIG.copilotHooksFile}`;
    const hasClaude = exists(claudePath);
    const hasCopilot = exists(copilotPath);
    if (declared !== undefined && declared !== `./${CONFIG.claudeHooksFile}`) {
      add('hooks', 'claude-path', 'error', `.claude-plugin/plugin.json "hooks" must be "./${CONFIG.claudeHooksFile}"`, [cPath], { hooks: declared });
    } else if (declared !== undefined && !hasClaude) {
      add('hooks', 'claude-path', 'error', `plugin.json declares hooks but ${CONFIG.claudeHooksFile} does not exist`, [cPath]);
    }
    if (hasClaude && declared === undefined) {
      add('hooks', 'claude-unlisted', 'error', `${CONFIG.claudeHooksFile} exists but plugin.json does not declare it (Claude Code loads only a declared path outside hooks/)`, [cPath, claudePath]);
    }
    if (hasClaude && !hasCopilot) {
      add('hooks', 'copilot-missing', 'error', 'Plugin ships Claude Code hooks but no Copilot hooks', [claudePath], undefined,
        `Add ${CONFIG.copilotHooksFile}; Agent Plugins 1.0 reads hooks only from the com.github.copilot namespace.`);
    }
    if (hasCopilot && !hasClaude) add('hooks', 'claude-missing', 'error', 'Plugin ships Copilot hooks but no Claude Code hooks', [copilotPath]);

    // event -> scripts it runs, per harness
    const claudeEvents = new Map();
    const copilotEvents = new Map();
    if (hasClaude) {
      const events = readJson(claudePath).hooks;
      if (!events || typeof events !== 'object') add('hooks', 'claude-format', 'error', 'Claude hooks file has no "hooks" object', [claudePath]);
      for (const [event, groups] of Object.entries(events ?? {})) {
        const scripts = [];
        for (const h of (Array.isArray(groups) ? groups : []).flatMap((g) => g?.hooks ?? [])) {
          const found = refs([h.command, ...(h.args ?? [])].join(' '), CONFIG.hookScriptRef.claude);
          if (h.type !== 'command' || typeof h.command !== 'string' || !found.length) {
            add('hooks', 'claude-format', 'error', `A '${event}' handler must be type "command" and run \${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs`, [claudePath]);
          }
          scripts.push(...found);
        }
        claudeEvents.set(event, sorted(scripts));
      }
    }
    if (hasCopilot) {
      const g = readJson(copilotPath);
      if (g.version !== 1 || !g.hooks || typeof g.hooks !== 'object') add('hooks', 'copilot-format', 'error', 'Copilot hooks file must be {"version": 1, "hooks": {...}}', [copilotPath]);
      for (const [event, entries] of Object.entries(g.hooks ?? {})) {
        const scripts = [];
        for (const h of Array.isArray(entries) ? entries : []) {
          const bash = sorted(refs(h.bash, CONFIG.hookScriptRef.bash));
          const ps = sorted(refs(h.powershell, CONFIG.hookScriptRef.powershell));
          if (h.type !== 'command' || typeof h.timeoutSec !== 'number' || !bash.length || !ps.length) {
            add('hooks', 'copilot-format', 'error', `A '${event}' entry needs type "command", a numeric timeoutSec, and bash ($PLUGIN_ROOT) and powershell ($env:PLUGIN_ROOT) commands that run scripts/<name>.mjs`, [copilotPath]);
          } else if (JSON.stringify(bash) !== JSON.stringify(ps)) {
            add('hooks', 'copilot-format', 'error', `A '${event}' entry runs different scripts in bash and powershell`, [copilotPath], { bash, powershell: ps });
          }
          scripts.push(...bash);
        }
        copilotEvents.set(event, sorted(scripts));
      }
    }
    if (hasClaude && hasCopilot) {
      const mapped = new Set(Object.values(CONFIG.hookEventMap));
      for (const [event, scripts] of claudeEvents) {
        const twin = CONFIG.hookEventMap[event];
        if (!twin) { add('hooks', 'harness-drift', 'error', `Claude event '${event}' has no Copilot counterpart in hookEventMap`, [claudePath, 'scripts/repo-audit.mjs']); continue; }
        if (JSON.stringify(scripts) !== JSON.stringify(copilotEvents.get(twin) ?? [])) {
          add('hooks', 'harness-drift', 'error', `'${event}' (Claude) and '${twin}' (Copilot) run different scripts`, [claudePath, copilotPath], { claude: scripts, copilot: copilotEvents.get(twin) ?? [] });
        }
      }
      for (const event of copilotEvents.keys()) {
        if (!mapped.has(event)) add('hooks', 'harness-drift', 'error', `Copilot event '${event}' has no Claude counterpart in hookEventMap`, [copilotPath, 'scripts/repo-audit.mjs']);
        else if (![...claudeEvents.keys()].some((e) => CONFIG.hookEventMap[e] === event)) {
          add('hooks', 'harness-drift', 'error', `Copilot event '${event}' has no Claude hook`, [copilotPath, claudePath]);
        }
      }
    }
    for (const s of sorted([...claudeEvents.values(), ...copilotEvents.values()].flat())) {
      const path = `${P(p)}/scripts/${s}`;
      if (!exists(path)) { add('hooks', 'script-missing', 'error', `A hook runs scripts/${s}, which does not exist`, [path]); continue; }
      // andes-init copies hook scripts into consumer repos, where no plugin dependencies exist.
      const specifiers = [...read(path).matchAll(/^\s*import\s[^'"]*?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/gm)].map((m) => m[1] ?? m[2]);
      const foreign = specifiers.filter((x) => !x.startsWith('node:'));
      if (foreign.length) add('hooks', 'script-imports', 'error', 'Hook scripts must import only node: built-ins', [path], { imports: foreign });
    }
  }
}

// --- memory ------------------------------------------------------------------
if (runs('memory')) {
  for (const f of ['.claude/CLAUDE.md', '.github/copilot-instructions.md']) {
    if (exists(f)) add('memory', 'shadowing-file', 'error', `${f} would load a second copy of the instructions (or shadow AGENTS.md)`, [f]);
  }
  if (exists('CLAUDE.md') && read('CLAUDE.md').trim() !== '@AGENTS.md') {
    add('memory', 'claude-stub', 'error', 'Root CLAUDE.md must contain exactly "@AGENTS.md"', ['CLAUDE.md']);
  }
  if (!exists('AGENTS.md') || !exists(CONFIG.agentsTemplate)) {
    add('memory', 'missing', 'error', 'AGENTS.md or the andes-init template is missing', ['AGENTS.md', CONFIG.agentsTemplate]);
  } else {
    const template = read(CONFIG.agentsTemplate).trim();
    const agentsMd = read('AGENTS.md');
    const m = agentsMd.match(/<!-- andes:begin[^>]*-->[\s\S]*?<!-- andes:end -->/g) ?? [];
    if (m.length !== 1) add('memory', 'block-count', 'error', `AGENTS.md must hold exactly one andes block (found ${m.length})`, ['AGENTS.md']);
    else if (m[0].trim() !== template) {
      add('memory', 'block-drift', 'error', 'The AGENTS.md andes block differs from the andes-init template', ['AGENTS.md', CONFIG.agentsTemplate],
        undefined, 'Edit the template, then copy it verbatim between the markers in AGENTS.md.');
    }
    const w = words(template);
    if (w > CONFIG.agentsBlockBudget) {
      add('memory', 'budget', 'warn', `The always-on andes block is ${w} words (budget ${CONFIG.agentsBlockBudget})`, [CONFIG.agentsTemplate], { words: w });
    }
    const loop = section(template, '## Review loop');
    if (!loop) add('memory', 'loop-missing', 'error', 'Template has no "## Review loop" section', [CONFIG.agentsTemplate]);
    for (const stem of CONFIG.loopAgents) {
      const a = agents.find((x) => x.harness === 'copilot' && x.stem === stem);
      if (!a) { add('memory', 'loop-agent-missing', 'error', `Loop agent '${stem}' does not exist`, ['scripts/repo-audit.mjs']); continue; }
      if (loop && section(a.body, '## Review loop') !== loop) {
        add('memory', 'loop-drift', 'error', 'The "## Review loop" section differs from AGENTS.md (Copilot subagents do not receive AGENTS.md, so it is copied verbatim)',
          [a.path, CONFIG.agentsTemplate]);
      }
    }
  }
}

// --- testing-policy ----------------------------------------------------------
if (runs('testing-policy')) {
  const scan = [...walkFiles(CONFIG.pluginsDir), ...(exists('AGENTS.md') ? ['AGENTS.md'] : [])];
  for (const f of scan) {
    if (!f.endsWith('.md')) continue;
    read(f).split('\n').forEach((line, i) => {
      if (CONFIG.bannedTestLibs.test(line) && !CONFIG.policyLine.test(line)) {
        add('testing-policy', 'banned-library', 'error', 'A banned test library is recommended (xUnit + NSubstitute only)', [`${f}:${i + 1}`],
          { line: line.trim().slice(0, 200) }, 'Rewrite the line to the xUnit + NSubstitute policy, or phrase it as a prohibition.');
      }
    });
  }
}

// --- csharp-policy -----------------------------------------------------------
if (runs('csharp-policy')) {
  const scan = [...walkFiles(CONFIG.pluginsDir), ...(exists('AGENTS.md') ? ['AGENTS.md'] : [])];
  for (const f of scan) {
    if (!f.endsWith('.md')) continue;
    read(f).split('\n').forEach((line, i) => {
      if (CONFIG.bannedCsharpPatterns.test(line) && !CONFIG.policyLine.test(line)) {
        add('csharp-policy', 'banned-pattern', 'error', 'A banned C# pattern is recommended (Minimal APIs, FluentValidation, no repositories, Add over AddAsync)', [`${f}:${i + 1}`],
          { line: line.trim().slice(0, 200) }, 'Rewrite the line to the csharp-standards non-negotiables, or phrase it as a prohibition.');
      }
    });
  }
}

// --- registry ----------------------------------------------------------------
if (runs('registry')) {
  // Maintainer commands are skills in .claude/skills/, which Claude Code and Copilot CLI both read.
  // .claude/commands and .github/prompts are single-harness surfaces (prompt files never load in the CLI).
  for (const legacy of ['.claude/commands', '.github/prompts']) {
    if (isDir(legacy)) add('registry', 'legacy-commands', 'error', `${legacy}/ is a single-harness command surface; maintainer commands live in .claude/skills/`, [legacy]);
  }
  const pluginSkills = new Set(plugins.flatMap((p) => dirs(`${P(p)}/skills`)));
  const maintainerSkills = dirs('.claude/skills');
  for (const s of maintainerSkills) {
    const path = `.claude/skills/${s}/SKILL.md`;
    if (!exists(path)) { add('registry', 'maintainer-skill', 'error', `Maintainer skill '${s}' has no SKILL.md`, [`.claude/skills/${s}`]); continue; }
    const { fm } = splitFrontmatter(read(path));
    if (fmScalar(fm, 'name') !== s) add('registry', 'maintainer-skill', 'error', `Maintainer skill name '${fmScalar(fm, 'name')}' does not match its folder '${s}'`, [path]);
    if (!fmScalar(fm, 'description')) add('registry', 'maintainer-skill', 'error', 'Maintainer skill has no description', [path]);
    if (fmScalar(fm, 'disable-model-invocation') === 'true') {
      add('registry', 'maintainer-skill', 'error', "'disable-model-invocation: true' makes the skill unreachable on Copilot CLI (github/copilot-cli#4438); guard in the body instead", [path]);
    }
    if (pluginSkills.has(s)) add('registry', 'maintainer-skill', 'error', `Maintainer skill '${s}' shadows the plugin skill of the same name (project skills win in Copilot CLI)`, [path]);
  }
  // This repo builds the marketplace; installing it here would load stale cached copies over the live files.
  if (exists('.claude/settings.json')) {
    const settings = readJson('.claude/settings.json');
    const selfPlugins = Object.keys(settings.enabledPlugins ?? {}).filter((k) => k.endsWith('@andes'));
    if (settings.extraKnownMarketplaces?.andes || selfPlugins.length) {
      add('registry', 'self-install', 'error', 'The repo settings register the andes marketplace or enable its plugins; develop with --plugin-dir instead',
        ['.claude/settings.json'], { plugins: selfPlugins });
    }
  }
  const readme = exists('README.md') ? read('README.md') : '';
  const names = [...plugins, ...new Set(agents.map((a) => a.stem)), ...pluginSkills, ...maintainerSkills.map((s) => `/${s}`)];
  for (const n of names) if (!readme.includes(n)) add('registry', 'readme-mention', 'warn', `'${n}' is not mentioned in README.md`, ['README.md']);
  if (exists(CONFIG.agentsTemplate)) {
    const tpl = read(CONFIG.agentsTemplate);
    for (const a of agents.filter((x) => x.harness === 'claude')) {
      if (!tpl.includes(a.stem)) add('registry', 'agent-unrouted', 'warn', `Claude agent '${a.stem}' is never named in the AGENTS.md block`, [CONFIG.agentsTemplate, a.path]);
    }
  }
}

// --- changelog ---------------------------------------------------------------
if (runs('changelog')) {
  if (!exists('CHANGELOG.md') || !read('CHANGELOG.md').includes('## [Unreleased]')) {
    add('changelog', 'missing-unreleased', 'error', 'Root CHANGELOG.md is missing its ## [Unreleased] section', ['CHANGELOG.md']);
  }
}

// --- links -------------------------------------------------------------------
if (runs('links')) {
  let checker = null;
  // Loaded lazily so a broken checker is one finding, not a crash that hides every other check.
  try { checker = await import(pathToFileURL(join(ROOT, CONFIG.linkChecker)).href); } catch (e) {
    add('links', 'checker-missing', 'error', `Cannot load the link checker (${e.message})`, [CONFIG.linkChecker]);
  }
  let tracked = null;
  try {
    tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md', '*.mdx', '*.markdown'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    add('links', 'no-git', 'warn', 'Not a git checkout; the link check was skipped', ['.']);
  }
  if (checker && tracked) {
    const lock = exists(CONFIG.upstreamLock) ? readJson(CONFIG.upstreamLock) : {};
    // Upstream-pinned skills cannot be edited here, so their links are upstream's to fix.
    const skip = [...Object.values(lock.skills ?? {}).map((e) => e.andes?.path).filter(Boolean).map((d) => `${d}/`), ...CONFIG.linkCheckExclude];
    const cache = {};
    for (const f of [...new Set(tracked)].sort()) {
      if (skip.some((s) => f.startsWith(s)) || !exists(f)) continue;
      for (const b of checker.findBrokenLinks(join(ROOT, f), { root: ROOT, cache })) {
        add('links', 'broken', 'error', `Broken link '${b.target}': ${b.reason}`, [`${f}:${b.line}`]);
      }
    }
  }
}

// --- report ------------------------------------------------------------------
const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');
const checkNames = ['manifests', 'skills', 'harness-paths', 'agents', 'mcp', 'hooks', 'memory', 'testing-policy', 'csharp-policy', 'registry', 'changelog', 'links'];
const report = {
  status: errors.length || (STRICT && warnings.length) ? 'findings' : 'clean',
  generatedAt: new Date().toISOString(),
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    checks: Object.fromEntries(checkNames.map((c) => [c, {
      errors: findings.filter((f) => f.check === c && f.severity === 'error').length,
      warnings: findings.filter((f) => f.check === c && f.severity === 'warn').length,
    }])),
  },
  findings,
  affectedPaths: [...new Set(findings.flatMap((f) => f.paths))].sort(),
};

const summaryLine =
  `Repo audit ${report.status === 'clean' ? 'clean' : 'found drift'}: ` +
  `${stats.plugins} plugins, ${stats.skills} skills, ${stats.claudeAgents} Claude + ${stats.copilotAgents} Copilot agents ` +
  `(${stats.agentTwins} twins). ${errors.length} error(s), ${warnings.length} warning(s)` +
  (warnings.length && !STRICT ? ' (warnings do not fail; use --strict to work them)' : '') + '.';

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const c of checkNames) {
    const fs = findings.filter((f) => f.check === c);
    if (!fs.length) continue;
    console.log(`\n${c}`);
    for (const f of fs) {
      console.log(`  ${f.severity === 'error' ? 'ERROR' : 'WARN '} ${f.id}: ${f.message}`);
      for (const p of f.paths) console.log(`        ${p}`);
      if (f.detail) console.log(`        ${JSON.stringify(f.detail)}`);
    }
  }
  console.log(`\n${summaryLine}`);
}

process.exit(report.status === 'clean' ? 0 : 10);
