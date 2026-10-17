// Andes branding for PptxGenJS (v4): slide masters with the Andes logo, theme fonts, and slide builders.
//
// Imports only node: modules. The build script creates the presentation with its own
// `pptxgenjs` and passes it in, because an ES module resolves packages from its own folder.
// PptxGenJS writes Office's default theme colors, so run `office_pkg.py theme` on the file afterwards.
// Builders record brand issues instead of stopping; writeDeck refuses to write while any remain.

import { readFileSync } from 'node:fs';

const BRAND_URL = new URL('../assets/brand.json', import.meta.url);
const LOGO_DIR = new URL('../assets/logo/', import.meta.url);

// LAYOUT_WIDE: 13.333 x 7.5 in. Every position below is in inches.
const W = 13.333;
const H = 7.5;
const M = 0.6;
const BODY_W = W - 2 * M;
const BODY_TOP = 1.5;
const BODY_H = 5.2;
const FOOTER_Y = 6.95;
const GUTTER = 0.533;
// The title and closing slides: navy panel on the left, the full-color logo on white at the right.
const PANEL_W = 8.6;
const MAX_BULLETS = 6;
const MAX_WORDS = 12;
const MIN_FONT_PT = 12;

const hex = (brand, role) => brand.colors[role].hex.slice(1).toUpperCase();
const words = (text) => String(text).split(/\s+/).filter(Boolean).length;

export function loadBrand(path = BRAND_URL) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// --- issues and deck rhythm ----------------------------------------------------
// One deck per build script, so issues are module-wide; slide kinds are kept per presentation.
const issues = [];
const kinds = new WeakMap();

function warn(message) {
  issues.push(message);
  console.warn(`warning: ${message}`);
}

function track(pptx, kind, slide) {
  if (!kinds.has(pptx)) kinds.set(pptx, []);
  kinds.get(pptx).push(kind);
  return slide;
}

export function checkFontSize(pt) {
  if (pt < MIN_FONT_PT) warn(`${pt} pt text is below the ${MIN_FONT_PT} pt minimum for slides`);
}

// Writes the deck when no brand issue is outstanding. strict: false writes anyway and only when
// the user has accepted the listed issues.
export async function writeDeck(pptx, fileName, { strict = true } = {}) {
  const deck = kinds.get(pptx) ?? [];
  if (deck[0] !== 'title') warn('the deck does not open with titleSlide');
  let run = 0;
  for (const [i, k] of deck.entries()) {
    run = k === 'bullets' ? run + 1 : 0;
    if (run === 3) warn(`slides ${i - 1}-${i + 1} are three bullet slides in a row; turn one into a stat, columns, process, or chart slide`);
  }
  const content = deck.filter((k) => !['title', 'section', 'quote', 'closing'].includes(k));
  const bullets = content.filter((k) => k === 'bullets').length;
  if (content.length >= 4 && bullets > content.length / 2) {
    warn(`${bullets} of ${content.length} content slides are bullets; vary the layouts`);
  }
  if (strict && issues.length) {
    const list = issues.splice(0).map((m) => `  - ${m}`).join('\n');
    throw new Error(`Deck not written. Fix these brand issues, or pass { strict: false } once the user accepts them:\n${list}`);
  }
  issues.length = 0;
  return pptx.writeFile({ fileName });
}

// --- images --------------------------------------------------------------------
// Pixel size from the PNG IHDR or the JPEG SOF segment, so images keep their aspect ratio.
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function imageRatio({ path, data, widthIn, heightIn }) {
  if (widthIn && heightIn) return widthIn / heightIn;
  const buf = path ? readFileSync(path) : Buffer.from(String(data).replace(/^(data:)?[\w/+.-]+;base64,/, ''), 'base64');
  const size = imageSize(buf);
  if (!size) throw new Error('Only PNG and JPEG sizes can be read; pass widthIn and heightIn for other images');
  return size.width / size.height;
}

// The largest box with the given ratio that fits inside w x h.
const fit = (ratio, w, h) => (w / h > ratio ? { w: h * ratio, h } : { w, h: w / ratio });

// Copies of andes-core's andes-brand logos (the audit keeps them identical). The names are fixed and
// sizes are read from the files, so new artwork under the same names needs no code change.
export const LOGOS = { full: 'andes-logo.png', mark: 'andes-mark.png', markWhite: 'andes-mark-white.png' };

function logo(name) {
  const buf = readFileSync(new URL(LOGOS[name], LOGO_DIR));
  const { width, height } = imageSize(buf);
  return { data: `image/png;base64,${buf.toString('base64')}`, ratio: width / height };
}

// --- masters -------------------------------------------------------------------
// PptxGenJS copies every placeholder of a master onto each slide that uses it, so a master holds
// only the placeholders all of its slides fill. Optional parts are plain text boxes. The logo is
// part of every master, so every slide built on one carries it.
export const MASTERS = { title: 'ANDES_TITLE', section: 'ANDES_SECTION', content: 'ANDES_CONTENT', visual: 'ANDES_VISUAL' };

// Sets layout, metadata, theme fonts, and the four Andes masters on a new presentation.
export function applyBrand(pptx, brand, { title, subject, author, company } = {}) {
  const { heading, body } = brand.fonts.office;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = title ?? '';
  pptx.subject = subject ?? '';
  pptx.author = author ?? brand.company;
  pptx.company = company ?? brand.company;
  pptx.theme = { headFontFace: heading, bodyFontFace: body };

  const altText = `${brand.company} logo`;
  const full = logo('full');
  const mark = logo('mark');
  const markWhite = logo('markWhite');
  const noLine = { type: 'none' };

  const fullSize = fit(full.ratio, 3.3, 2.6);
  const footerMark = { w: 0.3 * mark.ratio, h: 0.3 };
  const titlePlaceholder = { name: 'title', type: 'title', x: M, y: 0.4, w: BODY_W, h: 0.8, fontFace: heading, fontSize: 28, bold: true, color: hex(brand, 'primary'), align: 'left', valign: 'bottom', margin: 0 };
  const lightChrome = [
    { rect: { x: M, y: 1.25, w: 1.2, h: 0.06, fill: { color: hex(brand, 'accent') }, line: noLine } },
    { line: { x: M, y: 6.82, w: BODY_W, h: 0, line: { color: hex(brand, 'border'), width: 0.75 } } },
    { image: { x: M, y: FOOTER_Y, ...footerMark, data: mark.data, altText } },
    { text: { text: brand.company, options: { x: M + footerMark.w + 0.15, y: FOOTER_Y, w: 6, h: 0.3, fontFace: body, fontSize: 10, color: hex(brand, 'secondary'), valign: 'middle', margin: 0 } } },
  ];
  const slideNumber = (role) => ({ x: W - M - 0.6, y: FOOTER_Y, w: 0.6, h: 0.3, fontFace: body, fontSize: 10, color: hex(brand, role), align: 'right', valign: 'middle' });

  pptx.defineSlideMaster({
    title: MASTERS.title,
    background: { color: hex(brand, 'page') },
    objects: [
      { rect: { x: 0, y: 0, w: PANEL_W, h: H, fill: { color: hex(brand, 'primary') }, line: noLine } },
      { rect: { x: PANEL_W, y: 0, w: 0.08, h: H, fill: { color: hex(brand, 'accent') }, line: noLine } },
      { rect: { x: M, y: 3.55, w: 1.6, h: 0.08, fill: { color: hex(brand, 'accent') }, line: noLine } },
      { image: { x: PANEL_W + 0.08 + (W - PANEL_W - 0.08 - fullSize.w) / 2, y: (H - fullSize.h) / 2, ...fullSize, data: full.data, altText } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.4, w: PANEL_W - 2 * M, h: 2.0, fontFace: heading, fontSize: 40, bold: true, color: hex(brand, 'page'), align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
    ],
  });

  pptx.defineSlideMaster({
    title: MASTERS.section,
    background: { color: hex(brand, 'emphasis') },
    objects: [
      { rect: { x: M, y: 3.15, w: 1.2, h: 0.08, fill: { color: hex(brand, 'successFill') }, line: noLine } },
      { image: { x: M, y: 6.55, w: 0.45 * markWhite.ratio, h: 0.45, data: markWhite.data, altText } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 3.4, w: BODY_W, h: 1.4, fontFace: heading, fontSize: 36, bold: true, color: hex(brand, 'page'), align: 'left', valign: 'top', margin: 0 }, text: '' } },
    ],
    slideNumber: slideNumber('page'),
  });

  pptx.defineSlideMaster({
    title: MASTERS.content,
    background: { color: hex(brand, 'page') },
    objects: [
      { placeholder: { options: titlePlaceholder, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: M, y: BODY_TOP, w: BODY_W, h: BODY_H, fontFace: body, fontSize: 18, color: hex(brand, 'body'), valign: 'top', margin: 0 }, text: '' } },
      ...lightChrome,
    ],
    slideNumber: slideNumber('secondary'),
  });

  pptx.defineSlideMaster({
    title: MASTERS.visual,
    background: { color: hex(brand, 'page') },
    objects: [{ placeholder: { options: titlePlaceholder, text: '' } }, ...lightChrome],
    slideNumber: slideNumber('secondary'),
  });
}

const withNotes = (slide, notes) => {
  if (notes) slide.addNotes(notes);
  return slide;
};

// bullets: strings, or { text, level } for a sub-point (level 1).
function bulletRuns(items, fontSize) {
  return items.map(({ text, level }) => ({ text, options: { bullet: { indent: 18 }, indentLevel: level, fontSize: level ? fontSize - 2 : fontSize, breakLine: true, paraSpaceAfter: 6 } }));
}

function checkBullets(title, bullets, { max = MAX_BULLETS, fontSize, boxW, boxH }) {
  const items = bullets.map((b) => (typeof b === 'string' ? { text: b, level: 0 } : { level: 0, ...b }));
  if (items.length > max) warn(`"${title}": ${items.length} bullets; keep to ${max} or split the slide`);
  for (const { text } of items) {
    if (words(text) > MAX_WORDS) warn(`"${title}": a ${words(text)}-word bullet; keep bullets to ${MAX_WORDS} words and move detail to the notes`);
  }
  checkFontSize(fontSize - (items.some((i) => i.level) ? 2 : 0));
  const lines = items.reduce((n, { text, level }) => n + estimateLines(text, { fontSizePt: fontSize, boxWidthIn: boxW - 0.5 * (level + 1) }), 0);
  const capacity = Math.floor((boxH * 72) / (fontSize * 1.5));
  if (lines > capacity) warn(`"${title}": about ${lines} lines in room for ${capacity}; shorten or split the slide`);
  return items;
}

// --- slide builders ------------------------------------------------------------
export function titleSlide(pptx, brand, { title, subtitle, meta, notes }) {
  const { body } = brand.fonts.office;
  const textW = PANEL_W - 2 * M;
  if (estimateLines(title, { fontSizePt: 40, boxWidthIn: textW, avgCharEm: 0.55 }) > 3) warn(`"${title}": the title runs past three lines; shorten it`);
  const slide = pptx.addSlide({ masterName: MASTERS.title });
  slide.addText(title, { placeholder: 'title' });
  if (subtitle) slide.addText(subtitle, { x: M, y: 3.85, w: textW, h: 1.0, fontFace: body, fontSize: 20, color: hex(brand, 'accent'), valign: 'top', margin: 0 });
  if (meta) slide.addText(meta, { x: M, y: 6.3, w: textW, h: 0.5, fontFace: body, fontSize: 14, color: hex(brand, 'page'), margin: 0 });
  return track(pptx, 'title', withNotes(slide, notes));
}

export function sectionSlide(pptx, brand, { number, title, notes }) {
  const { heading } = brand.fonts.office;
  const slide = pptx.addSlide({ masterName: MASTERS.section });
  if (number != null) slide.addText(String(number).padStart(2, '0'), { x: M, y: 2.0, w: 3, h: 1.0, fontFace: heading, fontSize: 54, bold: true, color: hex(brand, 'accent'), margin: 0 });
  slide.addText(title, { placeholder: 'title' });
  return track(pptx, 'section', withNotes(slide, notes));
}

// items: up to eight short strings; more than four flow into two columns.
export function agendaSlide(pptx, brand, { title = 'Agenda', items, notes }) {
  const { heading, body } = brand.fonts.office;
  if (items.length > 8) warn(`"${title}": ${items.length} agenda items; keep to eight`);
  const cols = items.length > 4 ? 2 : 1;
  const perCol = Math.ceil(items.length / cols);
  const colW = cols === 2 ? (BODY_W - GUTTER) / 2 : BODY_W * 0.7;
  const rowH = Math.min(1.1, (BODY_H - 0.3) / perCol);
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  items.forEach((item, i) => {
    const x = M + Math.floor(i / perCol) * (colW + GUTTER);
    const y = BODY_TOP + 0.3 + (i % perCol) * rowH;
    slide.addText(String(i + 1).padStart(2, '0'), { x, y, w: 0.9, h: rowH - 0.15, fontFace: heading, fontSize: 28, bold: true, color: hex(brand, 'accentStrong'), valign: 'middle', margin: 0 });
    slide.addText(item, { x: x + 1.0, y, w: colW - 1.0, h: rowH - 0.15, fontFace: body, fontSize: 20, color: hex(brand, 'body'), valign: 'middle', margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x, y: y + rowH - 0.08, w: colW, h: 0, line: { color: hex(brand, 'border'), width: 0.75 } });
  });
  return track(pptx, 'agenda', withNotes(slide, notes));
}

export function bulletSlide(pptx, brand, { title, bullets, notes, fontSize = 18 }) {
  const items = checkBullets(title, bullets, { fontSize, boxW: BODY_W, boxH: BODY_H });
  const slide = pptx.addSlide({ masterName: MASTERS.content });
  slide.addText(title, { placeholder: 'title' });
  slide.addText(bulletRuns(items, fontSize), { placeholder: 'body' });
  return track(pptx, 'bullets', withNotes(slide, notes));
}

// stats: two to four { value, label, detail }. Keep each value to a few characters ("12%", "$4.2M").
export function statSlide(pptx, brand, { title, stats, source, notes }) {
  const { heading, body } = brand.fonts.office;
  if (stats.length < 2 || stats.length > 4) warn(`"${title}": ${stats.length} stats; use two to four tiles`);
  const gap = 0.4;
  const tileW = (BODY_W - gap * (stats.length - 1)) / stats.length;
  const valuePt = stats.length === 4 ? 44 : 54;
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  stats.forEach(({ value, label, detail }, i) => {
    const x = M + i * (tileW + gap);
    const y = BODY_TOP + 0.4;
    if (String(value).length * valuePt * 0.6 > tileW * 72 * 0.9) warn(`"${title}": the value "${value}" is too long for its tile`);
    slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: 3.8, fill: { color: hex(brand, 'surface') }, line: { color: hex(brand, 'border'), width: 0.75 } });
    slide.addShape(pptx.ShapeType.rect, { x, y, w: tileW, h: 0.08, fill: { color: hex(brand, 'accent') }, line: { type: 'none' } });
    slide.addText(String(value), { x, y: y + 0.45, w: tileW, h: 1.3, align: 'center', valign: 'middle', fontFace: heading, fontSize: valuePt, bold: true, color: hex(brand, 'primary'), margin: 0 });
    slide.addText(label, { x: x + 0.25, y: y + 1.85, w: tileW - 0.5, h: 0.8, align: 'center', valign: 'top', fontFace: body, fontSize: 18, bold: true, color: hex(brand, 'body'), margin: 0 });
    if (detail) slide.addText(detail, { x: x + 0.25, y: y + 2.65, w: tileW - 0.5, h: 1.0, align: 'center', valign: 'top', fontFace: body, fontSize: 14, color: hex(brand, 'secondary'), margin: 0 });
  });
  if (source) addSource(slide, brand, source);
  return track(pptx, 'stats', withNotes(slide, notes));
}

// columns: two or three { heading, bullets } or { heading, text }, for comparisons and options.
export function columnsSlide(pptx, brand, { title, columns, notes }) {
  const { heading, body } = brand.fonts.office;
  if (columns.length < 2 || columns.length > 3) warn(`"${title}": ${columns.length} columns; use two or three`);
  const n = columns.length;
  const colW = (BODY_W - GUTTER * (n - 1)) / n;
  const fontSize = n === 3 ? 16 : 18;
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  columns.forEach((col, i) => {
    const x = M + i * (colW + GUTTER);
    slide.addText(col.heading, { x, y: BODY_TOP + 0.1, w: colW, h: 0.6, fontFace: heading, fontSize: 20, bold: true, color: hex(brand, 'primary'), valign: 'bottom', margin: 0 });
    slide.addShape(pptx.ShapeType.rect, { x, y: BODY_TOP + 0.8, w: 0.8, h: 0.05, fill: { color: hex(brand, 'accent') }, line: { type: 'none' } });
    const box = { x, y: BODY_TOP + 1.05, w: colW, h: BODY_H - 1.1, fontFace: body, color: hex(brand, 'body'), valign: 'top', margin: 0 };
    if (col.bullets) {
      const items = checkBullets(title, col.bullets, { max: 5, fontSize, boxW: colW, boxH: box.h });
      slide.addText(bulletRuns(items, fontSize), box);
    } else {
      if (estimateLines(col.text, { fontSizePt: fontSize, boxWidthIn: colW }) > Math.floor((box.h * 72) / (fontSize * 1.3))) warn(`"${title}": the "${col.heading}" column overflows`);
      slide.addText(col.text, { ...box, fontSize });
    }
  });
  return track(pptx, 'columns', withNotes(slide, notes));
}

// steps: three to six { label, detail } on a connected timeline.
export function processSlide(pptx, brand, { title, steps, notes }) {
  const { heading, body } = brand.fonts.office;
  if (steps.length < 3 || steps.length > 6) warn(`"${title}": ${steps.length} steps; use three to six`);
  const colW = BODY_W / steps.length;
  const d = 0.8;
  const cy = BODY_TOP + 1.0;
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addShape(pptx.ShapeType.line, { x: M + colW / 2, y: cy, w: colW * (steps.length - 1), h: 0, line: { color: hex(brand, 'accent'), width: 2.5 } });
  steps.forEach(({ label, detail }, i) => {
    const cx = M + colW * i + colW / 2;
    slide.addShape(pptx.ShapeType.ellipse, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color: hex(brand, 'primary') }, line: { color: hex(brand, 'page'), width: 3 } });
    slide.addText(String(i + 1), { x: cx - d / 2, y: cy - d / 2, w: d, h: d, align: 'center', valign: 'middle', fontFace: heading, fontSize: 20, bold: true, color: hex(brand, 'page'), margin: 0 });
    slide.addText(label, { x: cx - colW / 2 + 0.1, y: cy + 0.7, w: colW - 0.2, h: 0.7, align: 'center', valign: 'top', fontFace: heading, fontSize: 18, bold: true, color: hex(brand, 'primary'), margin: 0 });
    if (detail) {
      if (words(detail) > 20) warn(`"${title}": step "${label}" has a ${words(detail)}-word detail; keep to 20`);
      slide.addText(detail, { x: cx - colW / 2 + 0.15, y: cy + 1.45, w: colW - 0.3, h: 2.2, align: 'center', valign: 'top', fontFace: body, fontSize: steps.length > 4 ? 14 : 16, color: hex(brand, 'body'), margin: 0 });
    }
  });
  return track(pptx, 'process', withNotes(slide, notes));
}

// type: 'bar' | 'column' | 'line' | 'pie' | 'doughnut'. data: [{ name, labels, values }].
// altText states the takeaway ("North leads every quarter"), not the chart type.
export function chartSlide(pptx, brand, { title, type, data, valueFormat = '#,##0', source, altText, notes }) {
  if (!altText) warn(`"${title}": no altText; describe what the chart shows`);
  const series = brand.series.map((role) => hex(brand, role));
  const isPie = type === 'pie' || type === 'doughnut';
  const count = isPie ? data[0].values.length : data.length;
  if (count > series.length) warn(`"${title}": ${count} ${isPie ? 'slices' : 'series'}; group the rest as "Other" (Slate) to stay within ${series.length}`);
  const { body } = brand.fonts.office;
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addChart(type === 'column' ? 'bar' : type, data, {
    x: M, y: BODY_TOP, w: BODY_W, h: source ? BODY_H - 0.4 : BODY_H,
    altText: altText ?? title,
    barDir: type === 'bar' ? 'bar' : 'col',
    barGapWidthPct: 60,
    chartColors: series,
    showLegend: isPie || data.length > 1,
    legendPos: 'b',
    legendFontFace: body,
    legendFontSize: 14,
    legendColor: hex(brand, 'body'),
    catAxisLabelFontFace: body,
    catAxisLabelFontSize: 14,
    catAxisLabelColor: hex(brand, 'body'),
    valAxisLabelFontFace: body,
    valAxisLabelFontSize: 12,
    valAxisLabelColor: hex(brand, 'secondary'),
    valAxisLabelFormatCode: valueFormat,
    valGridLine: { color: hex(brand, 'border'), style: 'solid', size: 0.75 },
    catGridLine: { style: 'none' },
    catAxisLineColor: hex(brand, 'secondary'),
    valAxisLineShow: false,
    dataBorder: isPie ? { pt: 1.5, color: hex(brand, 'page') } : undefined,
    lineSize: 3,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 8,
    showPercent: isPie,
    showValue: false,
    dataLabelColor: hex(brand, 'emphasis'),
    dataLabelFontFace: body,
    dataLabelFontSize: 12,
  });
  if (source) addSource(slide, brand, source);
  return track(pptx, 'chart', withNotes(slide, notes));
}

// header: column names; rows: arrays of cell values; align: 'left' | 'center' | 'right' per column.
export function tableSlide(pptx, brand, { title, header, rows, colW, align, notes, fontSize = 14 }) {
  const { heading, body } = brand.fonts.office;
  checkFontSize(fontSize);
  const a = (j) => align?.[j] ?? 'left';
  const border = { type: 'solid', pt: 0.75, color: hex(brand, 'border') };
  const head = header.map((h, j) => ({ text: String(h), options: { bold: true, fontFace: heading, color: hex(brand, 'page'), fill: { color: hex(brand, 'primary') }, align: a(j) } }));
  const bodyRows = rows.map((r, i) => r.map((v, j) => ({
    text: v == null ? '' : String(v),
    options: { fontFace: body, color: hex(brand, 'body'), align: a(j), ...(i % 2 ? { fill: { color: hex(brand, 'surfaceSubtle') } } : {}) },
  })));
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addTable([head, ...bodyRows], {
    x: M, y: BODY_TOP, w: BODY_W, colW, fontSize, border, valign: 'middle', margin: 0.08,
    autoPage: true, autoPageRepeatHeader: true, autoPageLineWeight: 0.1, autoPageSlideStartY: BODY_TOP,
  });
  return track(pptx, 'table', withNotes(slide, notes));
}

// An image with required alt text, fitted into the body area at its own aspect ratio.
export function imageSlide(pptx, brand, { title, path, data, altText, widthIn, heightIn, notes }) {
  if (!altText) throw new Error('imageSlide needs altText: describe what the image shows');
  const { w, h } = fit(imageRatio({ path, data, widthIn, heightIn }), BODY_W, BODY_H);
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addImage({ ...(path ? { path } : { data }), x: M + (BODY_W - w) / 2, y: BODY_TOP, w, h, altText });
  return track(pptx, 'image', withNotes(slide, notes));
}

// An image on one half and bullets or a paragraph on the other. side: 'left' | 'right' (the image).
export function imageTextSlide(pptx, brand, { title, path, data, altText, widthIn, heightIn, bullets, text, side = 'left', notes }) {
  if (!altText) throw new Error('imageTextSlide needs altText: describe what the image shows');
  const { body } = brand.fonts.office;
  const colW = (BODY_W - GUTTER) / 2;
  const { w, h } = fit(imageRatio({ path, data, widthIn, heightIn }), colW, BODY_H);
  const [imgX, textX] = side === 'left' ? [M, M + colW + GUTTER] : [M + colW + GUTTER, M];
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addImage({ ...(path ? { path } : { data }), x: imgX + (colW - w) / 2, y: BODY_TOP + (BODY_H - h) / 2, w, h, altText });
  const box = { x: textX, y: BODY_TOP, w: colW, h: BODY_H, fontFace: body, color: hex(brand, 'body'), valign: 'middle', margin: 0 };
  if (bullets) slide.addText(bulletRuns(checkBullets(title, bullets, { max: 5, fontSize: 18, boxW: colW, boxH: BODY_H }), 18), box);
  else slide.addText(text ?? '', { ...box, fontSize: 18 });
  return track(pptx, 'imageText', withNotes(slide, notes));
}

// A short quote on Ink. The quote is the slide title, so the outline and screen readers keep it.
export function quoteSlide(pptx, brand, { quote, speaker, notes }) {
  const { heading, body } = brand.fonts.office;
  if (words(quote) > 30) warn(`the quote "${quote.slice(0, 40)}…" has ${words(quote)} words; keep to 30`);
  const slide = pptx.addSlide({ masterName: MASTERS.section });
  slide.addText('“', { x: M - 0.05, y: 1.3, w: 1.5, h: 1.75, fontFace: heading, fontSize: 96, bold: true, color: hex(brand, 'accent'), valign: 'top', margin: 0 });
  slide.addText(quote, { placeholder: 'title', fontSize: 28 });
  if (speaker) {
    const lines = estimateLines(quote, { fontSizePt: 28, boxWidthIn: BODY_W, avgCharEm: 0.55 });
    slide.addText(`— ${speaker}`, { x: M, y: 3.4 + (lines * 28 * 1.2) / 72 + 0.45, w: BODY_W, h: 0.5, fontFace: body, fontSize: 16, color: hex(brand, 'accent'), margin: 0 });
  }
  return track(pptx, 'quote', withNotes(slide, notes));
}

// The last slide, on the title master: a closing line and how to reach the presenter.
export function closingSlide(pptx, brand, { title = 'Thank you', subtitle, contact, notes }) {
  const { body } = brand.fonts.office;
  const slide = pptx.addSlide({ masterName: MASTERS.title });
  slide.addText(title, { placeholder: 'title' });
  if (subtitle) slide.addText(subtitle, { x: M, y: 3.85, w: PANEL_W - 2 * M, h: 0.8, fontFace: body, fontSize: 20, color: hex(brand, 'accent'), valign: 'top', margin: 0 });
  const lines = [contact ?? []].flat();
  if (lines.length) slide.addText(lines.join('\n'), { x: M, y: 4.9, w: PANEL_W - 2 * M, h: 1.6, fontFace: body, fontSize: 16, color: hex(brand, 'page'), valign: 'top', margin: 0, paraSpaceAfter: 4 });
  return track(pptx, 'closing', withNotes(slide, notes));
}

function addSource(slide, brand, source) {
  slide.addText(`Source: ${source}`, { x: M, y: BODY_TOP + BODY_H - 0.3, w: BODY_W, h: 0.3, fontFace: brand.fonts.office.body, fontSize: 12, color: hex(brand, 'secondary'), margin: 0 });
}

// Rough line count for text in a box; flags overflow before anyone opens the deck.
export function estimateLines(text, { fontSizePt, boxWidthIn, avgCharEm = 0.5 }) {
  const charsPerLine = Math.max(1, Math.floor((boxWidthIn * 72) / (fontSizePt * avgCharEm)));
  return String(text).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}
