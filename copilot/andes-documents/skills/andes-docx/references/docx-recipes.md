# docx recipes

Each snippet assumes the build script set up in SKILL.md: `docx` is the package namespace, `a` is the imported `docx_brand.mjs`, and `brand = a.loadBrand()`.

## Landscape section for a wide table

A section changes the page setup from that point on. Give each section its own header and footer, because they are not inherited:

```js
sections: [
  { properties: a.pageProperties(docx, brand), ...a.headerFooter(docx, brand, { title }), children: body },
  {
    properties: a.pageProperties(docx, brand, { landscape: true }),
    ...a.headerFooter(docx, brand, { title }),
    children: [a.brandedTable(docx, brand, { header, rows, width: a.contentWidth(brand, { landscape: true }) })],
  },
],
```

## Footnotes

```js
const doc = new docx.Document({
  ...a.documentOptions(docx, brand, { title }),
  footnotes: { 1: { children: [new docx.Paragraph('Source: internal CRM export, 2026-09-30.')] } },
  sections: [{ children: [new docx.Paragraph({ children: [new docx.TextRun('Pipeline grew 12%'), new docx.FootnoteReferenceRun(1)] })] }],
});
```

## Images and charts

```js
import { readFileSync } from 'node:fs';
...a.figure(docx, brand, {
  data: readFileSync('<work>/pipeline.png'), type: 'png', widthPx: 600, heightPx: 320,
  alt: 'Column chart: North leads every quarter; West grows fastest, from 45k to 70k.',
  caption: 'Figure 1. Pipeline by region',
}),
```

- Size images to the content width at most: about 624 px for Letter portrait with one-inch margins at 96 dpi.
- Draw a chart in the brand series order (`brand.series`), with direct labels or a legend and titled axes. If no tool to render charts is available, ask the user before installing one.

## Page breaks and keeping content together

- `pageBreakBefore: true` on a heading starts it on a new page.
- `new docx.Paragraph({ children: [new docx.PageBreak()] })` adds an explicit break.
- Headings already carry `keepNext`, so a heading never ends a page alone. Add `keepNext: true` to a paragraph that introduces a table.

## Templates with placeholders

When the user supplies a branded `.docx` with `{{placeholders}}`, keep the template's look and fill it:

- **Text only:** run `docx_edit.py replace` (python-docx), with a mapping like `{"{{client}}": "Contoso"}`.
- **Rich content** (paragraphs or tables in place of a placeholder): use `patchDocument`:

```js
const out = await docx.patchDocument({
  outputType: 'nodebuffer',
  data: readFileSync('<template>.docx'),
  patches: {
    client: { type: docx.PatchType.PARAGRAPH, children: [new docx.TextRun('Contoso')] },
    summary_table: { type: docx.PatchType.DOCUMENT, children: [a.brandedTable(docx, brand, { header, rows })] },
  },
  keepOriginalStyles: true,
});
writeFileSync('<out>.docx', out);
```

Patch keys omit the braces (`client` matches `{{client}}`).

## Document properties

`documentOptions` sets title, subject, description, keywords, and the creator (the company, unless given). The title property is what screen readers and PDF converters announce, so always pass one.
