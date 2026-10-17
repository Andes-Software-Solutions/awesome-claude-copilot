// Andes branding for the docx npm package (v9).
//
// Imports only node: modules. The build script passes its own `docx` namespace as the first
// argument, because an ES module resolves packages from its own folder and this one has none.
//
//   const docx = await import('docx');
//   const brand = await import(pathToFileURL('<skill>/scripts/docx_brand.mjs').href);

import { readFileSync } from 'node:fs';

const BRAND_URL = new URL('../assets/brand.json', import.meta.url);
// Copies of andes-core's andes-brand logos; the audit keeps them identical.
const LOGO_DIR = new URL('../assets/logo/', import.meta.url);

// Page sizes in twips (1/1440 inch), portrait.
const PAGE = { letter: { width: 12240, height: 15840 }, a4: { width: 11906, height: 16838 } };
const MARGIN = 1440;

const hex = (brand, role) => brand.colors[role].hex.slice(1).toUpperCase();
const halfPoints = (pt) => pt * 2;

export function loadBrand(path = BRAND_URL) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// A logo as an ImageRun, sized by height or width in pixels (96 per inch) at the file's own ratio.
function logoRun(docx, brand, file, { widthPx, heightPx }) {
  const data = readFileSync(new URL(file, LOGO_DIR));
  const ratio = data.readUInt32BE(16) / data.readUInt32BE(20);
  const width = Math.round(widthPx ?? heightPx * ratio);
  const height = Math.round(heightPx ?? widthPx / ratio);
  const alt = `${brand.company} logo`;
  return new docx.ImageRun({ type: 'png', data, transformation: { width, height }, altText: { title: alt, description: alt, name: 'logo' } });
}

// Options for `new docx.Document({ ...documentOptions(docx, brand, {...}), sections })`.
export function documentOptions(docx, brand, { title, subject, description, creator, keywords } = {}) {
  const { heading, body } = brand.fonts.office;
  const headingStyle = (size, role, before, after) => ({
    run: { font: heading, size: halfPoints(size), bold: true, color: hex(brand, role) },
    paragraph: { spacing: { before, after }, keepNext: true, keepLines: true },
  });
  const bulletGlyphs = ['•', '◦', '▪'];
  const numberFormats = [docx.LevelFormat.DECIMAL, docx.LevelFormat.LOWER_LETTER, docx.LevelFormat.LOWER_ROMAN];
  const indent = (level) => ({ left: 360 + level * 360, hanging: 270 });
  return {
    creator: creator ?? brand.company,
    title,
    subject,
    description,
    keywords,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: body, size: halfPoints(11), color: hex(brand, 'body') },
          paragraph: { spacing: { after: 160, line: 276 } },
        },
        title: headingStyle(26, 'primary', 0, 120),
        heading1: headingStyle(18, 'primary', 360, 120),
        heading2: headingStyle(14, 'primary', 280, 100),
        heading3: headingStyle(12, 'emphasis', 240, 80),
        // docx ships Heading 4-6 in Office blue; restyle them so a deep outline stays on brand.
        heading4: headingStyle(11, 'emphasis', 200, 60),
        heading5: headingStyle(11, 'secondary', 200, 60),
        heading6: headingStyle(10, 'secondary', 160, 40),
        hyperlink: { run: { color: hex(brand, 'primary'), underline: { type: docx.UnderlineType.SINGLE } } },
      },
      paragraphStyles: [
        {
          id: 'AndesSubtitle', name: 'Andes Subtitle', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: heading, size: halfPoints(14), color: hex(brand, 'secondary') },
          paragraph: { spacing: { after: 480 } },
        },
        {
          id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: halfPoints(9), italics: true, color: hex(brand, 'secondary') },
          paragraph: { spacing: { before: 60, after: 240 } },
        },
        {
          id: 'AndesSmall', name: 'Andes Small', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: halfPoints(9), color: hex(brand, 'secondary') },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'andes-bullets',
          levels: bulletGlyphs.map((text, level) => ({
            level, format: docx.LevelFormat.BULLET, text, alignment: docx.AlignmentType.LEFT,
            style: { paragraph: { indent: indent(level) }, run: { color: hex(brand, 'primary') } },
          })),
        },
        {
          reference: 'andes-numbers',
          levels: numberFormats.map((format, level) => ({
            level, format, text: `%${level + 1}.`, alignment: docx.AlignmentType.LEFT,
            style: { paragraph: { indent: indent(level) } },
          })),
        },
      ],
    },
  };
}

// Section `properties`: page size from brand.defaults unless given, one-inch margins.
export function pageProperties(docx, brand, { size = brand.defaults.pageSize, landscape = false } = {}) {
  const page = PAGE[size.toLowerCase()];
  if (!page) throw new Error(`unknown page size '${size}'; use letter or a4`);
  return {
    page: {
      size: { ...page, orientation: landscape ? docx.PageOrientation.LANDSCAPE : docx.PageOrientation.PORTRAIT },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN, header: 720, footer: 720 },
    },
  };
}

// Text width between the margins, in twips; tables and images size from it.
export function contentWidth(brand, { size = brand.defaults.pageSize, landscape = false } = {}) {
  const page = PAGE[size.toLowerCase()];
  return (landscape ? page.height : page.width) - 2 * MARGIN;
}

export function bullet(docx, text, level = 0) {
  return new docx.Paragraph({ text, numbering: { reference: 'andes-bullets', level } });
}

export function numbered(docx, text, level = 0) {
  return new docx.Paragraph({ text, numbering: { reference: 'andes-numbers', level } });
}

// Title page content: the full Andes logo, title, subtitle, a metadata line (author, date), then a page break.
export function titleBlock(docx, brand, { title, subtitle, meta, pageBreak = true }) {
  const out = [
    new docx.Paragraph({ spacing: { before: 720, after: 0 }, children: [logoRun(docx, brand, 'andes-logo.png', { widthPx: 200 })] }),
    new docx.Paragraph({ text: title, heading: docx.HeadingLevel.TITLE, spacing: { before: 1200 } }),
    new docx.Paragraph({
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 18, color: hex(brand, 'accent'), space: 6 } },
      spacing: { after: 240 },
    }),
  ];
  if (subtitle) out.push(new docx.Paragraph({ text: subtitle, style: 'AndesSubtitle' }));
  if (meta) out.push(new docx.Paragraph({ text: meta, style: 'AndesSmall' }));
  if (pageBreak) out.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
  return out;
}

// A table with a navy header row that repeats on every page, banded rows, and horizontal rules only.
// widths are relative weights; align holds 'left' | 'center' | 'right' per column.
export function brandedTable(docx, brand, { header, rows, widths, align, width, fontSize = 10 }) {
  const total = width ?? contentWidth(brand);
  const weights = widths ?? header.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const columnWidths = weights.map((w) => Math.floor((total * w) / sum));
  const { heading, body } = brand.fonts.office;
  const rule = { style: docx.BorderStyle.SINGLE, size: 4, color: hex(brand, 'border') };
  const none = { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const alignment = (j) => docx.AlignmentType[(align?.[j] ?? 'left').toUpperCase()];
  const cell = (text, j, { fill, isHeader }) => new docx.TableCell({
    width: { size: columnWidths[j], type: docx.WidthType.DXA },
    shading: fill ? { fill, type: docx.ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: docx.VerticalAlign.CENTER,
    children: [new docx.Paragraph({
      alignment: alignment(j),
      spacing: { after: 0 },
      children: [new docx.TextRun({
        text: text == null ? '' : String(text),
        font: isHeader ? heading : body,
        bold: isHeader,
        size: halfPoints(fontSize),
        color: isHeader ? hex(brand, 'page') : hex(brand, 'body'),
      })],
    })],
  });
  return new docx.Table({
    width: { size: total, type: docx.WidthType.DXA },
    columnWidths,
    borders: { top: rule, bottom: rule, left: none, right: none, insideHorizontal: rule, insideVertical: none },
    rows: [
      new docx.TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, j) => cell(h, j, { fill: hex(brand, 'primary'), isHeader: true })) }),
      ...rows.map((r, i) => new docx.TableRow({
        cantSplit: true,
        children: r.map((v, j) => cell(v, j, { fill: i % 2 ? hex(brand, 'surfaceSubtle') : undefined, isHeader: false })),
      })),
    ],
  });
}

// Header (the Andes mark on the left, the document title in Slate on the right, a Glacier rule) and
// footer (company and classification on the left, "Page n of m" on the right). Spread into the
// section: `{ ...headerFooter(...) }`.
export function headerFooter(docx, brand, { title, classification } = {}) {
  const small = { size: halfPoints(9), color: hex(brand, 'secondary') };
  const right = [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }];
  const left = [brand.company, classification].filter(Boolean).join(' · ');
  return {
    headers: {
      default: new docx.Header({
        children: [new docx.Paragraph({
          tabStops: right,
          border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: hex(brand, 'accent'), space: 4 } },
          children: [logoRun(docx, brand, 'andes-mark.png', { heightPx: 24 }), new docx.TextRun({ text: `\t${title ?? ''}`, ...small })],
        })],
      }),
    },
    footers: {
      default: new docx.Footer({
        children: [new docx.Paragraph({
          tabStops: right,
          children: [
            new docx.TextRun({ text: left, ...small }),
            new docx.TextRun({ text: '\tPage ', ...small }),
            new docx.TextRun({ children: [docx.PageNumber.CURRENT], ...small }),
            new docx.TextRun({ text: ' of ', ...small }),
            new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES], ...small }),
          ],
        })],
      }),
    },
  };
}

const CALLOUT = {
  info: { role: 'accentStrong', label: 'Note' },
  success: { role: 'success', label: 'Result' },
  warning: { role: 'warning', label: 'Warning' },
  danger: { role: 'danger', label: 'Important' },
};

// A shaded paragraph with a colored left rule. The bold label carries the meaning, not the color.
export function callout(docx, brand, text, kind = 'info', label) {
  const k = CALLOUT[kind];
  if (!k) throw new Error(`unknown callout kind '${kind}'; use ${Object.keys(CALLOUT).join(', ')}`);
  return new docx.Paragraph({
    shading: { fill: hex(brand, 'surface'), type: docx.ShadingType.CLEAR, color: 'auto' },
    border: { left: { style: docx.BorderStyle.SINGLE, size: 24, color: hex(brand, k.role), space: 8 } },
    indent: { left: 180, right: 180 },
    spacing: { before: 120, after: 240 },
    children: [
      new docx.TextRun({ text: `${label ?? k.label}: `, bold: true, color: hex(brand, 'emphasis') }),
      new docx.TextRun({ text }),
    ],
  });
}

// An image with required alt text, followed by its caption.
export function figure(docx, brand, { data, type, widthPx, heightPx, alt, caption }) {
  if (!alt) throw new Error('figure needs alt text: describe what the image shows');
  const out = [new docx.Paragraph({
    alignment: docx.AlignmentType.CENTER,
    keepNext: Boolean(caption),
    children: [new docx.ImageRun({
      type, data, transformation: { width: widthPx, height: heightPx },
      altText: { title: caption ?? alt, description: alt, name: caption ?? 'figure' },
    })],
  })];
  if (caption) out.push(new docx.Paragraph({ text: caption, style: 'Caption', alignment: docx.AlignmentType.CENTER }));
  return out;
}

// An inline link in the brand link style (navy, underlined).
export function link(docx, text, url) {
  return new docx.ExternalHyperlink({ link: url, children: [new docx.TextRun({ text, style: 'Hyperlink' })] });
}
