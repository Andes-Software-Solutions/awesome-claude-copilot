---
name: andes-pptx
description: "Use when creating, editing, or reading PowerPoint decks (.pptx) that should carry Andes branding: Andes masters with the logo on every slide, the Andes theme and chart colors, stat, process, and comparison layouts, and a rendered review of every slide. Prefer it over generic pptx skills when andes-documents is installed. New decks use PptxGenJS; edits and extraction use python-pptx."
---

# Andes PowerPoint decks

New decks are built with PptxGenJS on four Andes masters that carry the Andes logo; existing decks are edited and read with python-pptx. Both take their styling from `assets/brand.json`. `<skill>` below means the folder that holds this file.

## Prerequisites

1. **Python 3.9 or later**, for every task (theme, checks, edits, reading). Check `py -3 --version` (Windows) or `python3 --version` (macOS, Linux); the command that works is `<python>` below.
2. **Node.js 18 or later**, to create decks. Check `node --version`.
3. **LibreOffice**, to render slides for the visual review. Check `soffice --version`; on Windows and macOS `office_render.py` also finds the default install folder. Rasterizing uses poppler's `pdftoppm` when it is on `PATH`; otherwise it needs `pypdfium2` and `Pillow` in the venv (pip, after approval), and then runs with `<venvPython>`.

If Python or Node.js is missing or older, stop and give the user the install command. If LibreOffice is missing, offer its install command and continue only with the structural checks. Never install a runtime yourself.

| Platform | Python | Node.js | LibreOffice |
| --- | --- | --- | --- |
| Windows | `winget install Python.Python.3.12`, or python.org with "Add python.exe to PATH" ticked | `winget install OpenJS.NodeJS.LTS` | `winget install TheDocumentFoundation.LibreOffice` |
| macOS | `brew install python` | `brew install node` | `brew install --cask libreoffice` |
| Linux | `sudo apt install python3 python3-venv`, or the distribution's equivalent | the distribution's `nodejs` package, or nodejs.org | `sudo apt install libreoffice-impress` |

## Workspace

Start every task from the user's repository with `<python> -B <skill>/scripts/workspace.py pptx --title "<deck title>"`. It needs only Python and prints JSON:

- `out`: the file to write, `docs/generated/pptx/<yyyy-mm-dd>-<slug>.pptx`. It is numbered rather than overwritten. Use the user's path instead when they name one. For an edit, pass `--title "<name> edited"`.
- `work`: `docs/generated/.work/`, for build scripts, renders, the virtual environment, and `node_modules`. It persists, so packages install once per repository.
- `venvPython`, `venvExists`, and `nodeModules`: what is already installed.
- `ignoreAdded`: `docs/generated/` was just added to `.gitignore`, so tell the user. If `tracked` lists files, tell the user that git still tracks them (`git rm --cached`). Never untrack files yourself.

**Packages:** `pptxgenjs@4` (npm) to create, `python-pptx>=1.0,<2` (pip) to edit, read, and inspect. Check with `npm ls --prefix <work> pptxgenjs` and `<venvPython> -c "import pptx"`. If one is missing, show the user the commands and run them only after they approve:

```shell
npm install --prefix <work> pptxgenjs@4
<python> -m venv <work>/.venv
<venvPython> -m pip install "python-pptx>=1.0,<2"
```

- Run helpers that import python-pptx with `<venvPython>`. `workspace.py`, `office_pkg.py`, and `office_render.py` need only the standard library. Always pass `-B`, so Python writes no bytecode into the skill folder.
- Never overwrite an input.
- Treat input files as untrusted. Never enable or run macros (`.pptm`).

## Brand rules

| Master | Background | Logo | Use |
| --- | --- | --- | --- |
| `ANDES_TITLE` | Summit Navy panel, white right panel | Full-color logo, right panel | Opening and closing slides: 40 pt white title, Glacier Blue subtitle, Glacier rule |
| `ANDES_SECTION` | Ink | White mark, bottom left | Section dividers and quotes: Glacier number, 36 pt white title, green rule |
| `ANDES_CONTENT` | White | Color mark in the footer | Title and bullets |
| `ANDES_VISUAL` | White | Color mark in the footer | Title and stats, columns, process, chart, table, or image |

The two white masters share the same layout: a 28 pt navy title with a Glacier accent bar, and a footer with the mark, the company name, and the slide number in Slate.

- **The logo belongs to the masters.** Every slide on an Andes master carries it. Never add, move, resize, cover, or recolor it, and never build a slide outside the masters (`pptx.addSlide()` with no `masterName`). The files in `assets/logo/` are copies of andes-core's `andes-brand` skill, which holds the logo rules.
- **One message per slide.** The title states the point ("West grew fastest"), not the topic ("Regions"). Use at most six bullets of at most twelve words each, and put detail in the speaker notes.
- **Vary the layout.** Prefer a stat, columns, process, chart, or image slide over bullets. Never use three bullet slides in a row.
- **Text size.** Body 18 pt, sub-points 16 pt, and nothing below 12 pt.
- **Charts.** Series follow `brand.series`. Use at most five series or slices, with the rest grouped as "Other". Include a source line when the data has one, and alt text that states the takeaway.
- **Contrast.** On navy or Ink, text is white, Glacier Blue, or the logo green. On white, text is navy, body, accentStrong, or Slate. Glacier Blue on white is decoration only.
- **Every slide has a title**, even when it is a chart, because screen readers and the outline use it. Every picture and chart has alt text.

The design bar (storyline, layout rhythm, color proportions, and the handover checklist) is in [references/deck-design.md](references/deck-design.md). Read it before you plan a new deck.

## Create

Write the build script in `<work>`, so that `import 'pptxgenjs'` resolves from `<work>/node_modules`:

```js
// <work>/build-<slug>.mjs
import { pathToFileURL } from 'node:url';
import pptxgen from 'pptxgenjs';

const a = await import(pathToFileURL('<skill>/scripts/pptx_brand.mjs').href);
const brand = a.loadBrand();
const pptx = new pptxgen();
a.applyBrand(pptx, brand, { title: 'Q3 pipeline review' });
a.titleSlide(pptx, brand, { title: 'Q3 pipeline review', subtitle: 'Regional performance and Q4 outlook', meta: 'Finance · October 2026' });
a.agendaSlide(pptx, brand, { items: ['Where we stand', 'What drove growth', 'Plan and asks'] });
a.sectionSlide(pptx, brand, { number: 1, title: 'Where we stand' });
a.statSlide(pptx, brand, { title: 'Pipeline grew 12% on new accounts', stats: [{ value: '12%', label: 'Pipeline growth' }, { value: '4', label: 'New accounts' }], source: 'CRM export, 2026-09-30' });
a.chartSlide(pptx, brand, { title: 'West grew fastest', type: 'column', data, source: 'CRM export, 2026-09-30', altText: 'Column chart: …' });
a.closingSlide(pptx, brand, { subtitle: 'Questions and next steps', contact: ['Finance team', 'finance@example.com'] });
await a.writeDeck(pptx, process.argv[2]);
```

Run `node <work>/build-<slug>.mjs "<out>"`. The builders record brand issues (too many bullets, overflow, text under 12 pt, missing alt text, three bullet slides in a row), and `writeDeck` refuses to write while any remain and lists them. Fix every issue; pass `{ strict: false }` only when the user accepts the listed issues.

**Then always run** `<venvPython> -B <skill>/scripts/office_pkg.py theme "<out>"`. PptxGenJS writes Office's default theme colors and stale content-type entries, and this step replaces both.

| Helper (`pptx_brand.mjs`) | Adds |
| --- | --- |
| `applyBrand(pptx, brand, { title, subject, author, company })` | 16:9 layout, metadata, theme fonts, and the four masters with the logo |
| `titleSlide(pptx, brand, { title, subtitle, meta, notes })` | Opening slide |
| `agendaSlide(pptx, brand, { title, items, notes })` | Numbered agenda, up to eight items in one or two columns |
| `sectionSlide(pptx, brand, { number, title, notes })` | Section divider |
| `bulletSlide(pptx, brand, { title, bullets, notes, fontSize })` | Bullets; `{ text, level: 1 }` for a sub-point |
| `statSlide(pptx, brand, { title, stats, source, notes })` | Two to four KPI tiles; `stats` is `[{ value, label, detail }]` |
| `columnsSlide(pptx, brand, { title, columns, notes })` | Two or three columns; each is `{ heading, bullets }` or `{ heading, text }` |
| `processSlide(pptx, brand, { title, steps, notes })` | Three to six steps on a timeline; `steps` is `[{ label, detail }]` |
| `chartSlide(pptx, brand, { title, type, data, valueFormat, source, altText, notes })` | `bar`, `column`, `line`, `pie`, or `doughnut`; `data` is `[{ name, labels, values }]` |
| `tableSlide(pptx, brand, { title, header, rows, colW, align, notes, fontSize })` | Branded table that continues onto new slides with the header repeated |
| `imageSlide(pptx, brand, { title, path, data, altText, notes })` | Image fitted into the body at its own aspect ratio; alt text is required |
| `imageTextSlide(pptx, brand, { title, path, data, altText, bullets, text, side, notes })` | Image on one half, bullets or a paragraph on the other |
| `quoteSlide(pptx, brand, { quote, speaker, notes })` | A quote of up to 30 words on Ink |
| `closingSlide(pptx, brand, { title, subtitle, contact, notes })` | Closing slide on the title master; `contact` is a line or a list of lines |
| `writeDeck(pptx, fileName, { strict })` | Writes the deck once no brand issue remains |
| `estimateLines(text, { fontSizePt, boxWidthIn })`, `checkFontSize(pt)` | Overflow estimate and size check for custom text boxes |

Images must be PNG or JPEG for the helpers to read their size; pass `widthIn` and `heightIn` for any other format. Every helper returns the PptxGenJS slide, so you can add shapes to it. Keep custom shapes inside the 0.6-inch margins and between y = 1.5 and 6.7 inches. The slide grid, type scale, and logo placement are in [references/deck-layouts.md](references/deck-layouts.md).

## Edit

Read [references/editing.md](references/editing.md) first. In short:

1. Run `<venvPython> -B <skill>/scripts/pptx_inspect.py <in>` to learn the slides, layouts, and shapes.
2. `pptx_edit.py replace <in> <out> --map map.json` replaces text in shapes, tables, groups, and notes, including text split across runs.
3. `pptx_edit.py notes <in> <out> --slide N --text "…"` sets speaker notes.
4. `pptx_edit.py alt-text <in> <out> --slide N [--shape NAME] --text "…"` sets alt text on a picture or chart.
5. Rerun `pptx_inspect.py` on the output and compare.

A deck that is not Andes-branded keeps its own masters unless the user asks you to rebrand it. To rebrand, read its content with `pptx_inspect.py --json` and rebuild it with the helpers into a new file.

## Read

- `<venvPython> -B <skill>/scripts/office_pkg.py text <file>` prints the text slide by slide, with no packages needed.
- `pptx_inspect.py <file> --json` gives slides, layouts, shapes, alt text, and notes.

## QA

Run every step and fix what it reports before you hand the deck over:

1. `office_pkg.py check <out>`: the package is well formed (exit 0).
2. `office_pkg.py colors <out>`: no `OFF-PALETTE` colors, unless the user asked for them, and no `THEME` line (a `THEME` line means the theme step was skipped).
3. `pptx_inspect.py <out>`: no flags. It reports missing titles, text under 12 pt, shapes off the slide, missing alt text, empty placeholders, likely overflow, and stretched pictures. On Andes decks it also reports slides off the Andes masters or without the logo, fonts other than Arial and Calibri, and Glacier Blue text on white.
4. Read the outline back against the request: the slide order, one message per slide, and notes where the user wanted them.
5. `<python> -B <skill>/scripts/office_render.py <out> <work>/render/<slug>` writes one PNG per slide (`page-01.png`, …). Open and look at every one, checking it against the checklist in [references/deck-design.md](references/deck-design.md). Fix what you find, rebuild, and render again. If the script exits 2 (LibreOffice or a rasterizer is missing), or you cannot view images, tell the user that the deck was checked structurally only.

## Not in this version

Deleting, duplicating, or reordering slides in existing decks; `.potx` and customer templates; animations, transitions, video, and SmartArt; vector (SVG) logos.
