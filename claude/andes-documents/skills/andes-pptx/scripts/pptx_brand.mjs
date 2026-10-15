// Andes branding for PptxGenJS (v4): slide masters, theme fonts, and slide builders.
//
// Imports only node: modules. The build script creates the presentation with its own
// `pptxgenjs` and passes it in, because an ES module resolves packages from its own folder.
// PptxGenJS writes Office's default theme colors, so run `office_pkg.py theme` on the file afterwards.

import { readFileSync } from 'node:fs';

const BRAND_URL = new URL('../assets/brand.json', import.meta.url);

// LAYOUT_WIDE: 13.333 x 7.5 in. Every position below is in inches.
const W = 13.333;
const M = 0.6;
const BODY_W = W - 2 * M;
const BODY_TOP = 1.5;
const BODY_H = 5.2;
const MAX_BULLETS = 6;
const MAX_WORDS = 12;
const MIN_FONT_PT = 12;

const hex = (brand, role) => brand.colors[role].hex.slice(1).toUpperCase();

export function loadBrand(path = BRAND_URL) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// PptxGenJS copies every placeholder of a master onto each slide that uses it, so a master holds
// only the placeholders all of its slides fill. Optional parts are plain text boxes.
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

  const titlePlaceholder = { name: 'title', type: 'title', x: M, y: 0.4, w: BODY_W, h: 0.8, fontFace: heading, fontSize: 28, bold: true, color: hex(brand, 'primary'), valign: 'bottom', margin: 0 };
  const lightChrome = [
    { rect: { x: M, y: 1.25, w: 1.2, h: 0.06, fill: { color: hex(brand, 'accent') }, line: { type: 'none' } } },
    { text: { text: brand.company, options: { x: M, y: 6.95, w: 6, h: 0.3, fontFace: body, fontSize: 10, color: hex(brand, 'secondary'), margin: 0 } } },
  ];
  const slideNumber = (role) => ({ x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontFace: body, fontSize: 10, color: hex(brand, role), align: 'right' });

  pptx.defineSlideMaster({
    title: MASTERS.title,
    background: { color: hex(brand, 'primary') },
    objects: [
      { rect: { x: M, y: 3.55, w: 1.6, h: 0.08, fill: { color: hex(brand, 'accent') }, line: { type: 'none' } } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.4, w: BODY_W, h: 2.0, fontFace: heading, fontSize: 40, bold: true, color: hex(brand, 'page'), valign: 'bottom', margin: 0 }, text: '' } },
    ],
  });

  pptx.defineSlideMaster({
    title: MASTERS.section,
    background: { color: hex(brand, 'emphasis') },
    objects: [
      { rect: { x: M, y: 3.15, w: 1.2, h: 0.08, fill: { color: hex(brand, 'successFill') }, line: { type: 'none' } } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 3.4, w: BODY_W, h: 1.4, fontFace: heading, fontSize: 36, bold: true, color: hex(brand, 'page'), valign: 'top', margin: 0 }, text: '' } },
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

export function titleSlide(pptx, brand, { title, subtitle, meta, notes }) {
  const { body } = brand.fonts.office;
  const slide = pptx.addSlide({ masterName: MASTERS.title });
  slide.addText(title, { placeholder: 'title' });
  if (subtitle) slide.addText(subtitle, { x: M, y: 3.85, w: BODY_W, h: 1.0, fontFace: body, fontSize: 20, color: hex(brand, 'accent'), valign: 'top', margin: 0 });
  if (meta) slide.addText(meta, { x: M, y: 6.3, w: BODY_W, h: 0.5, fontFace: body, fontSize: 14, color: hex(brand, 'page'), margin: 0 });
  return withNotes(slide, notes);
}

export function sectionSlide(pptx, brand, { number, title, notes }) {
  const { heading } = brand.fonts.office;
  const slide = pptx.addSlide({ masterName: MASTERS.section });
  if (number != null) slide.addText(String(number).padStart(2, '0'), { x: M, y: 2.0, w: 3, h: 1.0, fontFace: heading, fontSize: 54, bold: true, color: hex(brand, 'accent'), margin: 0 });
  slide.addText(title, { placeholder: 'title' });
  return withNotes(slide, notes);
}

// bullets: strings, or { text, level } for a sub-point (level 1).
export function bulletSlide(pptx, brand, { title, bullets, notes, fontSize = 18 }) {
  const items = bullets.map((b) => (typeof b === 'string' ? { text: b, level: 0 } : { level: 0, ...b }));
  if (items.length > MAX_BULLETS) warn(`"${title}": ${items.length} bullets; keep to ${MAX_BULLETS} or split the slide`);
  for (const { text } of items) {
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) warn(`"${title}": a ${words}-word bullet; keep bullets to ${MAX_WORDS} words and move detail to the notes`);
  }
  const lines = items.reduce((n, { text, level }) => n + estimateLines(text, { fontSizePt: fontSize, boxWidthIn: BODY_W - 0.5 * (level + 1) }), 0);
  const capacity = Math.floor((BODY_H * 72) / (fontSize * 1.5));
  if (lines > capacity) warn(`"${title}": about ${lines} lines in room for ${capacity}; shorten or split the slide`);
  const slide = pptx.addSlide({ masterName: MASTERS.content });
  slide.addText(title, { placeholder: 'title' });
  slide.addText(
    items.map(({ text, level }) => ({ text, options: { bullet: { indent: 18 }, indentLevel: level, fontSize: level ? fontSize - 2 : fontSize, breakLine: true, paraSpaceAfter: 6 } })),
    { placeholder: 'body' },
  );
  return withNotes(slide, notes);
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
  if (source) {
    slide.addText(`Source: ${source}`, { x: M, y: BODY_TOP + BODY_H - 0.3, w: BODY_W, h: 0.3, fontFace: body, fontSize: 12, color: hex(brand, 'secondary'), margin: 0 });
  }
  return withNotes(slide, notes);
}

// header: column names; rows: arrays of cell values; align: 'left' | 'center' | 'right' per column.
export function tableSlide(pptx, brand, { title, header, rows, colW, align, notes, fontSize = 14 }) {
  const { heading, body } = brand.fonts.office;
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
  return withNotes(slide, notes);
}

// An image with required alt text, fitted into the body area.
export function imageSlide(pptx, brand, { title, path, data, altText, widthIn, heightIn, notes }) {
  if (!altText) throw new Error('imageSlide needs altText: describe what the image shows');
  const ratio = widthIn && heightIn ? widthIn / heightIn : BODY_W / BODY_H;
  const w = Math.min(BODY_W, BODY_H * ratio);
  const h = w / ratio;
  const slide = pptx.addSlide({ masterName: MASTERS.visual });
  slide.addText(title, { placeholder: 'title' });
  slide.addImage({ ...(path ? { path } : { data }), x: M + (BODY_W - w) / 2, y: BODY_TOP, w, h, altText });
  return withNotes(slide, notes);
}

// Rough line count for text in a box; flags overflow before anyone opens the deck.
export function estimateLines(text, { fontSizePt, boxWidthIn, avgCharEm = 0.5 }) {
  const charsPerLine = Math.max(1, Math.floor((boxWidthIn * 72) / (fontSizePt * avgCharEm)));
  return String(text).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

export function checkFontSize(pt) {
  if (pt < MIN_FONT_PT) warn(`${pt} pt text is below the ${MIN_FONT_PT} pt minimum for slides`);
}

function warn(message) {
  console.warn(`warning: ${message}`);
}
