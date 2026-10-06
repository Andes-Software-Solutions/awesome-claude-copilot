#!/usr/bin/env node
// Broken local-link check for Markdown: relative files, images, reference definitions, and
// #heading anchors (GitHub slug rules). No network — external URLs are never fetched.
//
//   node scripts/check-links.mjs <file.md>...  prints file:line findings
//
// Exits 0 clean, 10 findings, 1 error — the repo-audit contract. repo-audit's `links` check
// imports findBrokenLinks directly.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKDOWN = new Set(['.md', '.mdx', '.markdown']);

const blank = (s) => s.replace(/[^\n]/g, ' ');
const normalize = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s).replace(/\r\n?/g, '\n');

// Front matter and fenced code become spaces, so offsets and line numbers survive masking.
// Fences match at any indent because list items indent them past CommonMark's three spaces.
function maskBlocks(text) {
  const lines = text.split('\n');
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.findIndex((l, k) => k > 0 && (l === '---' || l === '...'));
    if (end > 0) {
      for (let k = 0; k <= end; k++) lines[k] = blank(lines[k]);
      i = end + 1;
    }
  }
  let fence = null;
  for (; i < lines.length; i++) {
    if (fence) {
      const close = lines[i].match(/^[ \t>]*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      lines[i] = blank(lines[i]);
      continue;
    }
    const open = lines[i].match(/^[ \t>]*(`{3,}|~{3,})(.*)$/);
    // A backtick fence's info string cannot contain a backtick; such a line is inline code.
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = open[1];
      lines[i] = blank(lines[i]);
    }
  }
  return lines.join('\n');
}

const maskComments = (text) => text.replace(/<!--[\s\S]*?-->/g, blank);

function maskInlineCode(text) {
  const out = [];
  const paragraphEnd = /\n[ \t]*\n/y;
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '`') { out.push(text[i++]); continue; }
    let n = 0;
    while (text[i + n] === '`') n++;
    let close = -1;
    for (let j = i + n; j < text.length;) {
      if (text[j] === '`') {
        let m = 0;
        while (text[j + m] === '`') m++;
        if (m === n) { close = j; break; }
        j += m;
        continue;
      }
      paragraphEnd.lastIndex = j;
      if (paragraphEnd.test(text)) break;
      j++;
    }
    if (close < 0) { out.push(text.slice(i, i + n)); i += n; continue; }
    out.push(blank(text.slice(i, close + n)));
    i = close + n;
  }
  return out.join('');
}

const maskEscapes = (text) => text.replace(/\\[\\[\]()]/g, '  ');
const maskAll = (text) => maskEscapes(maskComments(maskInlineCode(maskBlocks(normalize(text)))));

function lineIndexer(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

// True when the `]` at `close` ends a bracketed link text on the same paragraph.
function opensLinkText(src, close) {
  let depth = 0;
  for (let i = close - 1; i >= 0 && close - i < 2000; i--) {
    const c = src[i];
    if (c === '\n' && /^\n[ \t]*$/.test(src.slice(i, src.indexOf('\n', i + 1) >>> 0))) return false;
    if (c === ']') depth++;
    else if (c === '[') {
      if (depth === 0) return true;
      depth--;
    }
  }
  return false;
}

function readDestination(src, pos) {
  let i = pos;
  while (src[i] === ' ' || src[i] === '\t') i++;
  if (src[i] === '\n') {
    i++;
    while (src[i] === ' ' || src[i] === '\t') i++;
  }
  if (src[i] === '<') {
    const end = src.indexOf('>', i + 1);
    const nl = src.indexOf('\n', i + 1);
    if (end < 0 || (nl >= 0 && nl < end)) return null;
    return { dest: src.slice(i + 1, end), start: i };
  }
  const start = i;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (/\s/.test(c)) break;
    if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) break;
      depth--;
    }
  }
  return i === start ? null : { dest: src.slice(start, i), start };
}

/** Every link destination in a Markdown document, outside code and comments. */
export function extractLinks(text) {
  const src = maskAll(text);
  const lineAt = lineIndexer(src);
  const out = [];
  for (let i = src.indexOf(']('); i >= 0; i = src.indexOf('](', i + 2)) {
    if (!opensLinkText(src, i)) continue;
    const d = readDestination(src, i + 2);
    if (d) out.push({ target: d.dest, line: lineAt(d.start) });
  }
  for (const m of src.matchAll(/^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\n?[ \t]*(<[^>\n]*>|\S+)/gm)) {
    const raw = m[1];
    const dest = raw.startsWith('<') ? raw.slice(1, -1) : raw;
    out.push({ target: dest, line: lineAt(m.index + m[0].length - raw.length) });
  }
  for (const m of src.matchAll(/<(?:a|img|source)\b[^>]*?\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    out.push({ target: m[1] ?? m[2], line: lineAt(m.index) });
  }
  return out.sort((a, b) => a.line - b.line);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

// Heading source → the text GitHub renders, which is what its slugger sees.
function headingText(raw) {
  const codes = [];
  let s = raw.replace(/(`+)([\s\S]*?)\1/g, (_, __, c) => `\u0000${codes.push(c.trim()) - 1}\u0000`);
  s = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\\(.)/g, '$1')
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => codes[Number(n)]);
}

// github-slugger: lowercase, drop punctuation except `-` and `_`, one `-` per space (no trim).
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');

/** The anchors GitHub generates for a document, plus explicit id/name attributes. */
export function headingAnchors(text) {
  const src = maskComments(maskBlocks(normalize(text)));
  const lines = src.split('\n');
  const anchors = new Set();
  const counts = new Map();
  const addHeading = (raw) => {
    const base = slug(headingText(raw.trim()));
    let id = base;
    while (anchors.has(id)) {
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      id = `${base}-${n}`;
    }
    anchors.add(id);
  };
  const atx = /^(?:[ \t]*>)*[ \t]{0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  const notParagraph = /^[ \t]*$|^[ \t]*(?:#|>|[-*+][ \t]|\d+[.)][ \t]|\||<)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(atx);
    if (m) { addHeading(m[1] ?? ''); continue; }
    const next = lines[i + 1];
    if (next !== undefined && /^ {0,3}(?:=+|-+)[ \t]*$/.test(next) && !notParagraph.test(lines[i])) {
      addHeading(lines[i]);
      i++;
    }
  }
  for (const m of maskAll(text).matchAll(/<[a-z][^>]*?\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(m[1]);
  return new Set([...anchors].map((a) => a.toLowerCase()));
}

function findRoot(start) {
  for (let d = start; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

// github.com is case-sensitive; macOS and Windows checkouts are not, so compare each segment.
function existsExact(abs, stop, dirCache) {
  if (!existsSync(abs)) return false;
  for (let p = abs; p !== stop && dirname(p) !== p; p = dirname(p)) {
    const parent = dirname(p);
    let entries = dirCache.get(parent);
    if (!entries) {
      try { entries = new Set(readdirSync(parent)); } catch { return true; }
      dirCache.set(parent, entries);
    }
    if (!entries.has(basename(p))) return false;
  }
  return true;
}

function missingReason(file) {
  try {
    const name = basename(file).toLowerCase();
    const near = readdirSync(dirname(file)).find((e) => e.toLowerCase() === name);
    if (near) return `no such file; '${near}' differs only in letter case (GitHub paths are case-sensitive)`;
  } catch { /* parent folder is missing too */ }
  return 'no such file';
}

const isExternal = (dest) => /^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith('//');

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/**
 * Broken local links in one Markdown file: [{ line, target, reason }].
 * `root` resolves `/`-rooted links (default: the enclosing git checkout); `cache` may be shared
 * across calls that do not modify files, as repo-audit does.
 */
export function findBrokenLinks(absFile, { root = findRoot(dirname(absFile)) ?? dirname(absFile), text, cache = {} } = {}) {
  cache.anchors ??= new Map();
  cache.dirs ??= new Map();
  const anchorsOf = (file, content) => {
    if (!cache.anchors.has(file)) cache.anchors.set(file, headingAnchors(content ?? readFileSync(file, 'utf8')));
    return cache.anchors.get(file);
  };
  const source = text ?? readFileSync(absFile, 'utf8');
  // Only a git checkout has a boundary GitHub enforces; without one, root is a best guess.
  const bounded = existsSync(join(root, '.git'));
  const broken = [];
  for (const { target, line } of extractLinks(source)) {
    const dest = target.trim();
    if (!dest || isExternal(dest) || /[{}$]/.test(dest)) continue;
    const hash = dest.indexOf('#');
    const pathPart = decode((hash < 0 ? dest : dest.slice(0, hash)).split('?')[0]);
    const anchor = hash < 0 ? '' : decode(dest.slice(hash + 1));
    let file = absFile;
    if (pathPart) {
      file = pathPart.startsWith('/') ? join(root, pathPart) : resolve(dirname(absFile), pathPart);
      const fromRoot = relative(root, file);
      if (bounded && (fromRoot.split(sep)[0] === '..' || isAbsolute(fromRoot))) {
        broken.push({ line, target, reason: 'outside the repository; GitHub cannot resolve it' });
        continue;
      }
      if (!existsExact(file, root, cache.dirs)) {
        broken.push({ line, target, reason: missingReason(file) });
        continue;
      }
    }
    if (!anchor || /^L\d+(-L\d+)?$/.test(anchor)) continue;
    if (!MARKDOWN.has(extname(file).toLowerCase()) || !statSync(file).isFile()) continue;
    const anchors = file === absFile ? anchorsOf(file, source) : anchorsOf(file);
    if (!anchors.has(anchor.toLowerCase())) {
      const where = file === absFile ? 'this file' : relative(dirname(absFile), file).split(sep).join('/');
      broken.push({ line, target, reason: `no heading or anchor '#${anchor}' in ${where}` });
    }
  }
  return broken;
}

function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!files.length) {
    process.stderr.write('usage: node scripts/check-links.mjs <file.md>...\n');
    process.exitCode = 1;
    return;
  }
  let found = 0;
  for (const f of files) {
    for (const b of findBrokenLinks(resolve(f))) {
      found++;
      console.log(`${f}:${b.line}: ${b.target} — ${b.reason}`);
    }
  }
  process.exitCode = found ? 10 : 0;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  try { main(); } catch (err) {
    process.stderr.write(`andes check-links: ${err.message}\n`);
    process.exitCode = 1;
  }
}
