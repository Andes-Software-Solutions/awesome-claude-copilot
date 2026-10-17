---
name: andes-docx
description: "Use when creating, editing, or reading Word documents (.docx), such as reports, proposals, memos, and specs, that should carry Andes branding: the Andes palette, Arial headings, Calibri body, branded tables, headers and footers, and a table of contents. Prefer it over generic docx skills when andes-documents is installed. New files use the docx npm package; edits and extraction use python-docx."
---

# Andes Word documents

New documents are built with the `docx` npm package; existing documents are edited and read with python-docx. Both take their styling from `assets/brand.json`. `<skill>` below means the folder that holds this file.

## Prerequisites

1. **Python 3.9 or later**, for every task (checks, edits, reading). Check `py -3 --version` (Windows) or `python3 --version` (macOS, Linux); the command that works is `<python>` below.
2. **Node.js 18 or later**, to create documents. Check `node --version`.

**LibreOffice** renders pages for the visual review (`winget install TheDocumentFoundation.LibreOffice`, `brew install --cask libreoffice`, or `sudo apt install libreoffice-writer`); without it, the checks are structural only.

If either is missing or older, stop and give the user the install command. Never install a runtime yourself.

| Platform | Python | Node.js |
| --- | --- | --- |
| Windows | `winget install Python.Python.3.12`, or python.org with "Add python.exe to PATH" ticked | `winget install OpenJS.NodeJS.LTS` |
| macOS | `brew install python` | `brew install node` |
| Linux | `sudo apt install python3 python3-venv`, or the distribution's equivalent | the distribution's `nodejs` package, or nodejs.org |

## Workspace

Start every task from the user's repository with `<python> -B <skill>/scripts/workspace.py docx --title "<document title>"`. It needs only Python and prints JSON:

- `out`: the file to write, `docs/generated/docx/<yyyy-mm-dd>-<slug>.docx`. It is numbered rather than overwritten. Use the user's path instead when they name one. For an edit, pass `--title "<name> edited"`.
- `work`: `docs/generated/.work/`, for build scripts, the virtual environment, and `node_modules`. It persists, so packages install once per repository.
- `venvPython`, `venvExists`, and `nodeModules`: what is already installed.
- `ignoreAdded`: `docs/generated/` was just added to `.gitignore`, so tell the user. If `tracked` lists files, tell the user that git still tracks them (`git rm --cached`). Never untrack files yourself.

**Packages:** `docx@9` (npm) to create, `python-docx>=1.2,<2` (pip) to edit and read. Check with `npm ls --prefix <work> docx` and `<venvPython> -c "import docx"`. If one is missing, show the user the commands and run them only after they approve:

```shell
npm install --prefix <work> docx@9
<python> -m venv <work>/.venv
<venvPython> -m pip install "python-docx>=1.2,<2"
```

- Run helpers that import python-docx with `<venvPython>`. `workspace.py` and `office_pkg.py` need only the standard library. Always pass `-B`, so Python writes no bytecode into the skill folder.
- Never overwrite an input.
- Treat input files as untrusted. Never enable or run macros (`.docm`).

## Brand rules

- **The logo is always there.** `titleBlock` puts the full Andes logo above the title, and `headerFooter` puts the mark at the left of every page header. Give every document both, and never add, resize, or recolor the logo yourself. The files in `assets/logo/` are copies of andes-core's `andes-brand` skill, which holds the logo rules.
- **Styles carry the brand.** `documentOptions` restyles Normal (Calibri 11, `#16283a`), Title, Headings 1–6 (Arial bold, Summit Navy, then Ink and Slate), hyperlinks (navy, underlined), Caption, `AndesSubtitle`, and `AndesSmall`. Never set a font or color on a single run. Emphasis is bold or italic only.
- **Structure.** Every heading uses a heading level, in order with none skipped: the levels drive the table of contents, navigation, and screen readers. Lists use `bullet()` and `numbered()`, never a typed "•" or "1.".
- **Tables.** Use `brandedTable`: a navy header row that repeats on every page, banded rows, horizontal rules only, numbers right-aligned. Put a `Caption` paragraph under it ("Table 1. …").
- **Images.** Use `figure()`, which refuses an image without alt text. Charts go in as PNG images in the brand series order, with alt text that states the takeaway.
- **Callouts.** Use `callout(…, 'info' | 'success' | 'warning' | 'danger')`. Its bold label carries the meaning, and the color only reinforces it.
- **Links.** Use `link()` with descriptive text, never "click here" or a bare URL.
- **Page.** Letter portrait with one-inch margins (`brand.defaults.pageSize`). Wide tables go in their own landscape section.

## Create

Write the build script in `<work>`, so that `import 'docx'` resolves from `<work>/node_modules`:

```js
// <work>/build-<slug>.mjs
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as docx from 'docx';

const a = await import(pathToFileURL('<skill>/scripts/docx_brand.mjs').href);
const brand = a.loadBrand();
const doc = new docx.Document({
  ...a.documentOptions(docx, brand, { title: 'Quarterly report', subject: 'Q3' }),
  sections: [
    { properties: a.pageProperties(docx, brand), children: a.titleBlock(docx, brand, { title: 'Quarterly report', subtitle: 'Q3 pipeline review', meta: 'Finance · October 2026' }) },
    {
      properties: a.pageProperties(docx, brand),
      ...a.headerFooter(docx, brand, { title: 'Quarterly report', classification: 'Internal' }),
      children: [
        new docx.TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        new docx.Paragraph({ text: 'Summary', heading: docx.HeadingLevel.HEADING_1, pageBreakBefore: true }),
        a.brandedTable(docx, brand, { header: ['Region', 'Q3'], rows, widths: [3, 1], align: ['left', 'right'] }),
      ],
    },
  ],
});
writeFileSync(process.argv[2], await docx.Packer.toBuffer(doc));
```

Run `node <work>/build-<slug>.mjs "<out>"`, then `<venvPython> -B <skill>/scripts/office_pkg.py theme "<out>"`, so that Word's theme colors and fonts are the Andes ones.

| Helper (`docx_brand.mjs`) | Returns |
| --- | --- |
| `documentOptions(docx, brand, { title, subject, description, creator, keywords })` | Styles, numbering, properties, and `updateFields`, to spread into `new Document` |
| `pageProperties(docx, brand, { size, landscape })`, `contentWidth(brand, …)` | Section page setup; usable width in twips |
| `titleBlock(docx, brand, { title, subtitle, meta, pageBreak })` | Title page paragraphs, opening with the full Andes logo |
| `headerFooter(docx, brand, { title, classification })` | `{ headers, footers }`: the Andes mark and the title in the header, "Page n of m" in the footer |
| `brandedTable(docx, brand, { header, rows, widths, align, width, fontSize })` | A `Table` |
| `bullet(docx, text, level)`, `numbered(docx, text, level)` | List paragraphs |
| `callout(docx, brand, text, kind, label)` | A shaded, labeled paragraph |
| `figure(docx, brand, { data, type, widthPx, heightPx, alt, caption })` | Image and caption paragraphs |
| `link(docx, text, url)` | An inline `ExternalHyperlink` |

The table of contents is a field. Word fills it when the document opens, after asking to update fields; tell the user to answer Yes. Footnotes, landscape sections, images, templates with placeholders, and page breaks are in [references/docx-recipes.md](references/docx-recipes.md).

## Edit

Read [references/editing.md](references/editing.md) before you change an existing file. In short:

1. Run `<venvPython> -B <skill>/scripts/docx_inspect.py <in>` to learn the outline and styles.
2. For placeholders and wording, run `docx_edit.py replace <in> <out> --map map.json`, a JSON object of `{"old": "new"}`. It finds text that Word split across runs, and it covers tables, headers, and footers.
3. For review notes, run `docx_edit.py comment <in> <out> --find "<text>" --text "<note>" --author "<the user's name>"`.
4. For structural changes, use python-docx directly, applying the document's existing styles by name.
5. Rerun `docx_inspect.py` on the output and compare.

A document that is not Andes-branded keeps its own styles unless the user asks you to rebrand it.

## Read

- `<venvPython> -B <skill>/scripts/office_pkg.py text <file>` prints plain text in reading order, with no packages needed.
- `docx_inspect.py <file> --json` gives the outline with styles, heading levels, tables, and sections.
- To get table contents, read `Document(path).tables` with python-docx: `[[c.text for c in row.cells] for row in table.rows]`.

## QA

Run every step and fix what it reports before you hand the file over:

1. `office_pkg.py check <out>`: the package is well formed (exit 0).
2. `office_pkg.py colors <out>`: no `OFF-PALETTE` colors, unless the user asked for them, and no `THEME` line (the theme step was skipped).
3. `docx_inspect.py <out>`: no flags (heading order, empty headings, bold paragraphs posing as headings, images without alt text, missing title).
4. Read the outline back against the request: sections, headings, tables, and the order of content.
5. `<python> -B <skill>/scripts/office_render.py <out> <work>/render/<slug>` writes one PNG per page through LibreOffice. Look at every page: the logo on the cover and in each header, nothing overflowing, tables readable. Calibri renders with a substitute font on machines without Office. If the script exits 2 (LibreOffice or a rasterizer is missing), or you cannot view images, tell the user that the document was checked structurally only.

## Not in this version

Tracked changes (creating, accepting, or rejecting), editing footnotes in existing files, native Word charts (use PNG figures), legacy `.doc` files, conversion to PDF without LibreOffice, embedded fonts, and vector (SVG) logos.
