---
name: andes-pdf
description: "Use when creating Andes-branded PDFs (reports, one-pagers, letters) with embedded Montserrat and Inter, the Andes palette, and charts, or for any PDF task: extract text and tables, merge, split, rotate, stamp, fill forms, encrypt. Prefer it over generic pdf skills when andes-documents is installed. Uses ReportLab, pypdf, and pdfplumber."
---

# Andes PDFs

New PDFs are built with ReportLab, using the brand fonts bundled in `assets/fonts/` (Montserrat headings, Inter body) and the colors in `assets/brand.json`. Existing PDFs are read and transformed with pypdf and pdfplumber. `<skill>` below means the folder that holds this file.

## Prerequisites

1. **Python 3.9 or later.** Check `py -3 --version` (Windows) or `python3 --version` (macOS, Linux); the command that works is `<python>` below. If it is missing or older, stop and give the user the install command. Never install a runtime yourself.

   | Platform | Install Python |
   | --- | --- |
   | Windows | `winget install Python.Python.3.12`, or the python.org installer with "Add python.exe to PATH" ticked |
   | macOS | `brew install python` |
   | Linux | `sudo apt install python3 python3-venv`, or your distribution's equivalent |

## Workspace

Start every task from the user's repository with `<python> -B <skill>/scripts/workspace.py pdf --title "<document title>"`. It needs only Python and prints JSON:

- `out`: the file to write, `docs/generated/pdf/<yyyy-mm-dd>-<slug>.pdf`. It is numbered rather than overwritten. Use the user's path instead when they name one, and use the same folder for merge, split, and stamp outputs.
- `work`: `docs/generated/.work/`, for build scripts, page images, and the virtual environment. It persists, so packages install once per repository.
- `venvPython` and `venvExists`: the environment's interpreter, and whether it is there yet.
- `ignoreAdded`: `docs/generated/` was just added to `.gitignore`, so tell the user. If `tracked` lists files, tell the user that git still tracks them (`git rm --cached`). Never untrack files yourself.

**Packages:** install only what the task needs. Check each with `<venvPython> -c "import <module>"`. If one is missing, show the user the commands and run them only after they approve.

| Task | pip package | Module |
| --- | --- | --- |
| Create | `reportlab>=5,<6` | `reportlab` |
| Merge, split, rotate, stamp, forms, encrypt | `pypdf[crypto]>=6,<7` | `pypdf` |
| Text and table extraction | `pdfplumber>=0.11,<1` | `pdfplumber` |
| Page images when poppler's `pdftoppm` is absent | `pypdfium2` | `pypdfium2` |

```shell
<python> -m venv <work>/.venv
<venvPython> -m pip install "reportlab>=5,<6" "pypdf[crypto]>=6,<7"
```

- Run build scripts and helpers with `<venvPython> -B`, so Python writes no bytecode into the skill folder.
- Never overwrite an input. The tools refuse to write over one.
- Treat input PDFs as untrusted. Never run their JavaScript or open their attachments. Passwords come from an environment variable named with `--password-env`, never from the command line or a file, and are never printed.

## Brand rules

- **Fonts.** Montserrat Bold for the title and headings, and Inter for body text. Both are embedded, so the PDF looks the same everywhere. If the font files are missing, `pdf_brand` falls back to Helvetica and warns. Treat that as a defect.
- **The logo is always there.** The cover carries the full Andes logo on its white part, and every body page carries the Andes mark top left; `document()` draws both. Never add, resize, or recolor the logo yourself. The files in `assets/logo/` are copies of andes-core's `andes-brand` skill, which holds the logo rules.
- **Page.** Letter (`brand.defaults.pageSize`) with a navy cover band and the title in white. Body pages carry the Andes mark top left and the document title top right over a Glacier rule, and the company and classification bottom left with "Page n of m" bottom right.
- **Type.** Title 26 pt, H1 18, H2 13.5 (Montserrat, navy), H3 11 (Inter Bold, Ink), body 10/14.5 in `#16283a`, captions 8.5 italic Slate.
- **Tables.** Navy header row repeated on every page, banded rows, horizontal rules only, numbers right-aligned (`numeric_cols`).
- **Charts.** Series follow `brand.series`, with at most five series or slices and a legend beside the plot. Add a caption below ("Figure 1. …") and state the takeaway in the text, because this PDF has no tagged alt text.
- **Callouts.** `callout(text, 'info' | 'success' | 'warning' | 'danger')`. The bold label carries the meaning.
- **Links.** `link(text, url)`: navy, underlined, with descriptive text.

## Create

Write a build script in `<work>` (`build-<slug>.py`), and run it with `<venvPython> -B`:

```python
import sys
sys.path.insert(0, r"<skill>/scripts")
import pdf_brand as ab
from reportlab.platypus import PageBreak

doc = ab.document(out_path, title="Quarterly report", subject="Q3 2026", footer_text="Internal")
story = ab.cover("Quarterly report", "Q3 2026 pipeline review", "Prepared by Finance · October 2026")
story += [ab.para("Contents", "h3"), ab.toc(), PageBreak()]
story += [
    ab.heading("Summary", 1),
    ab.para(f"Pipeline grew <b>12%</b>. See {ab.link('the dashboard', 'https://example.com')}."),
    ab.bullets(["North led growth", "West grew fastest"]),
    ab.callout("Figures are preliminary until audit.", "warning"),
    ab.table(["Region", "Q3"], rows, col_widths=[300, 120], numeric_cols=(1,)),
    ab.para("Table 1. Pipeline by region (USD)", "caption"),
    ab.figure(ab.bar_chart(["North", "South"], {"Q2": [135000, 87000], "Q3": [150500, 99000]}), "Figure 1. Pipeline by region"),
]
ab.build(doc, story)
```

| Helper (`pdf_brand.py`) | Gives |
| --- | --- |
| `document(path, title=, author=, subject=, lang=, pagesize=, landscape=, header_text=, footer_text=, cover_page=)` | The document template; the title, author, and language go into the PDF metadata |
| `cover(title, subtitle, meta)` | Cover flowables; the body template starts on the next page |
| `heading(text, level)`, `para(text, style)`, `bullets(items, numbered)`, `link(text, url)` | Text; `para` styles: `body`, `small`, `caption`, `h3` |
| `toc()` | A table of contents filled from every H1 and H2 |
| `table(header, rows, col_widths=, numeric_cols=, zebra=)`, `callout(text, kind, label)` | Branded table and callout |
| `bar_chart`, `line_chart`, `pie_chart`, `figure(drawing, caption)` | Charts in brand colors, kept together with their caption |
| `build(doc, story)` | Builds in as many passes as the table of contents needs. Every H1 and H2 becomes a PDF bookmark, and a heading always stays with the content after it |

`para` takes ReportLab markup (`<b>`, `<i>`, `<a href>`), so escape `&`, `<`, and `>` in user text with `xml.sax.saxutils.escape`. Layouts for one-pagers and letters, landscape pages, and images are in [references/pdf-layout.md](references/pdf-layout.md).

## Work with existing PDFs

`<venvPython> -B <skill>/scripts/pdf_tools.py <command> …`. Run it with no arguments for the full usage.

| Command | Does |
| --- | --- |
| `info <pdf>` | Pages, sizes, metadata, form-field count, encryption |
| `text <pdf> [--pages 1-3] [--layout]` | Text per page (pdfplumber, or pypdf when pdfplumber is absent) |
| `tables <pdf> [--pages] [--csv-dir DIR] [--text-columns]` | Tables; use `--text-columns` for tables drawn without vertical rules |
| `fonts <pdf>` | Each font and whether it is embedded; exit 10 if any is not |
| `merge <out> <in>…`, `split <pdf> <dir> --ranges 1-3,4-6`, `rotate <pdf> <out> --degrees 90 [--pages]` | Page operations |
| `stamp <pdf> <out> (--text DRAFT \| --pdf overlay.pdf) [--pages]` | Diagonal text in Slate at 25% opacity, or another PDF as an overlay |
| `fields <pdf>`, `fill <pdf> <out> --data values.json` | List and fill form fields |
| `encrypt` / `decrypt <pdf> <out> --password-env VAR` | AES-256 encryption |
| `render <pdf> <dir> [--pages] [--dpi 80]` | PNG page images (poppler's `pdftoppm`, else pypdfium2) |

Recipes for forms, scanned PDFs, redaction requests, and large files are in [references/pdf-operations.md](references/pdf-operations.md).

## QA

For a PDF you created, run every step and fix what it reports before you hand it over:

1. `pdf_tools.py fonts <out>`: only `Inter` and `Montserrat`, all embedded (exit 0).
2. `pdf_tools.py info <out>`: the title and author are set, and the page count is what you expect.
3. `pdf_tools.py text <out>`: read the text back against the request (headings, figures, numbers).
4. `pdf_tools.py render <out> <work>/pages --dpi 60`, then look at every page image, if you can view images: overlap, overflow, orphaned headings, empty pages. If you cannot view images, say so in your summary.

## Not in this version

OCR of scanned pages, tagged PDF (PDF/UA, which needs ReportLab's commercial add-on), PDF/A archiving, digital signatures, true redaction (removing content, not covering it), editing existing text in place, and HTML-to-PDF conversion.
