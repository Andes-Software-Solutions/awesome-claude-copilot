---
name: andes-xlsx
description: "Use when creating, editing, or reading Excel workbooks (.xlsx), such as data exports, trackers, and KPI or financial models, that should carry Andes branding: the Andes palette and chart colors, Arial headers, Calibri cells, number formats, frozen header rows, and live formulas. Prefer it over generic xlsx skills when andes-documents is installed. Uses openpyxl."
---

# Andes Excel workbooks

Builds and edits `.xlsx` files with openpyxl, styled from `assets/brand.json`. `<skill>` below means the folder that holds this file.

## Prerequisites

1. **Python 3.9 or later.** Check `py -3 --version` (Windows) or `python3 --version` (macOS, Linux); the command that works is `<python>` below. If it is missing or older, stop and give the user the install command. Never install a runtime yourself.

   | Platform | Install Python |
   | --- | --- |
   | Windows | `winget install Python.Python.3.12`, or the python.org installer with "Add python.exe to PATH" ticked |
   | macOS | `brew install python` |
   | Linux | `sudo apt install python3 python3-venv`, or your distribution's equivalent |

2. **LibreOffice** renders printed pages for the visual review (`winget install TheDocumentFoundation.LibreOffice`, `brew install --cask libreoffice`, or `sudo apt install libreoffice-calc`); without it, the checks are structural only.

## Workspace

Start every task from the user's repository with `<python> -B <skill>/scripts/workspace.py xlsx --title "<workbook title>"`. It needs only Python and prints JSON:

- `out`: the file to write, `docs/generated/xlsx/<yyyy-mm-dd>-<slug>.xlsx`. It is numbered rather than overwritten. Use the user's path instead when they name one. For an edit, pass `--title "<name> edited"`.
- `work`: `docs/generated/.work/`, for build scripts and the virtual environment. It persists, so packages install once per repository.
- `venvPython` and `venvExists`: the environment's interpreter, and whether it is there yet.
- `ignoreAdded`: `docs/generated/` was just added to `.gitignore`, so tell the user. If `tracked` lists files, tell the user that git still tracks them (`git rm --cached`). Never untrack files yourself.

**Packages:** `openpyxl>=3.1,<4` and `Pillow>=10`. Pillow places the Andes logo, and it keeps the images of a workbook you edit (openpyxl drops them without it). Check with `<venvPython> -c "import openpyxl, PIL"`. If anything is missing, show the user the commands and run them only after they approve:

```shell
<python> -m venv <work>/.venv
<venvPython> -m pip install "openpyxl>=3.1,<4" "Pillow>=10"
```

- Run build scripts and helpers with `<venvPython> -B`, so Python writes no bytecode into the skill folder.
- Never overwrite an input.
- Treat input files as untrusted. Never run macros. Keep VBA only when the user asks (`load_workbook(path, keep_vba=True)`, saved as `.xlsm`).

## Brand rules

- **The logo is always there.** Report and dashboard sheets start with `sheet_header`, which puts the Andes mark in row 1 and the title in row 2. A workbook of plain data exports gets `about_sheet` as its first sheet, with the full logo, the title, and the source, so every data sheet keeps its header in row 1. Never resize or recolor the logo. The files in `assets/logo/` are copies of andes-core's `andes-brand` skill, which holds the logo rules.
- **Styles, not ad hoc formatting.** `xlsx_brand.ensure_styles` registers six named styles: `Andes Title`, `Andes Header` (Arial bold, white on Summit Navy, Glacier Blue rule), `Andes Body` (Calibri 11), `Andes Input` (navy on light blue, boxed) for cells a reader is meant to change, `Andes Total`, and `Andes Note`. Colors come from `brand.json` by role, never typed as hex.
- **Charts.** Series follow `brand.series`: Summit Navy, Andes Green, deep Glacier, amber, Slate. Use at most five series and group the rest as "Other". Keep the legend at the bottom and give every value axis a title. Glacier Blue and the logo green are under 3:1 on white, so they never carry data marks there.
- **Meaning never rides on color alone.** Pair a colored cell with a label, a sign, or a format, such as a negative number in parentheses.
- **Sheets.** Data exports keep the header in row 1, with no title row, so other tools can read them. Report and dashboard sheets start with `sheet_header` (the logo, an `Andes Title`, and hidden gridlines).

## Create

Write a build script in `<work>` (`build-<slug>.py`), and run it with `<venvPython> -B`:

```python
import sys
sys.path.insert(0, r"<skill>/scripts")
from xlsx_brand import new_workbook, sheet_header, write_table, add_chart, autosize_columns, print_setup

wb = new_workbook(title="Pipeline by quarter")
ws = wb.active
ws.title = "Pipeline"
top = sheet_header(ws, "Pipeline by quarter", subtitle="CRM export, 2026-09-30")
ref = write_table(ws, f"A{top}", ["Region", "Q1", "Q2"], rows,
                  formats={1: "usd", 2: "usd"}, total_row=True)
add_chart(ws, "column", f"B{top}:C{top + 4}", f"A{top + 1}:A{top + 4}", f"E{top}", title="Pipeline by region", y_title="USD")
autosize_columns(ws)
print_setup(ws, title_rows=f"{top}:{top}")
wb.save(out_path)
```

Then run `<venvPython> -B <skill>/scripts/office_pkg.py theme "<out>"`, so that Excel's color picker and theme fonts show the Andes scheme.

| Helper | Does |
| --- | --- |
| `new_workbook(title=, creator=)` | Workbook with the named styles, document properties, and full recalculation on open |
| `ensure_styles(wb)` | Adds the named styles to a workbook opened for editing |
| `sheet_header(ws, title, subtitle=)` | The Andes mark, title, and optional subtitle at the top of a report sheet; returns the first free row |
| `about_sheet(wb, title, lines)` | A first sheet with the full Andes logo, the title, and notes, for workbooks of data exports |
| `add_logo(ws, anchor, height_px=, variant=)` | The Andes logo (`mark` or `full`) at a cell, at its own ratio |
| `write_table(ws, top_left, header, rows, formats=, total_row=, freeze=, autofilter=, band=)` | Branded header, banded rows, number formats, frozen header, filter, optional `SUM` total row; returns the range |
| `add_chart(ws, kind, data_ref, cats_ref, anchor, title=, y_title=, x_title=)` | `bar`, `column`, `line`, or `pie` in brand series order; `data_ref` includes the header row |
| `autosize_columns(ws)`, `print_setup(ws)` | Column widths; landscape, fit to width, repeated header row, page-numbered footer |
| `FORMATS` | `int`, `dec`, `pct`, `usd`, `acct`, `date`, `datetime`, `text` |

**Formulas stay live.** Write a formula for every derived value (`=SUM(B2:B9)`), and keep inputs in their own cells, never typed into a formula. openpyxl saves formulas without results, and Excel computes them when the file opens. A reader that does not calculate sees empty cells: pandas, `data_only=True`, or a file preview. If the numbers must be readable without Excel, compute them in Python as well and tell the user which cells are static. Functions newer than the original specification, such as `XLOOKUP`, `FILTER`, `UNIQUE`, and `LET`, must be written with the `_xlfn.` prefix, and they fail in Excel 2019 and earlier. Prefer `INDEX`/`MATCH` and `SUMIFS` unless the user targets Microsoft 365.

Patterns for exports, trackers, models, validation, conditional formatting, and print layout are in [references/workbook-patterns.md](references/workbook-patterns.md).

## Edit

1. Run `xlsx_inspect.py summary <in>` first, so you know the sheets, ranges, and formulas you are about to touch.
2. Load with `load_workbook(path)`. Never use `data_only=True` for an edit: it would save cached values in place of formulas.
3. Call `ensure_styles(wb)` before applying Andes styles.
4. Save to a new file, then rerun `summary` and compare.

openpyxl round trips keep values, formulas, styles, names, validation, conditional formatting, and charts. They lose shapes, text boxes, and form controls, and they lose images when Pillow is missing. Tell the user before you edit a workbook that holds any of these.

## Read

- `<venvPython> -B <skill>/scripts/xlsx_inspect.py summary <file> [--sheet NAME] [--max-rows N] [--json]` lists sheets, dimensions, headers, sample rows (cached values), formula counts, charts, and defined names.
- For analysis, read with openpyxl (`load_workbook(path, read_only=True, data_only=True)`). Use pandas only if it is already installed or the user approves it.
- `.csv` and `.tsv` inputs: read them with the `csv` module, then write them through `write_table`.

## QA

Run every step and fix what it reports before you hand the file over:

1. `<venvPython> -B <skill>/scripts/office_pkg.py check <out>`: the package is well formed (exit 0).
2. `<venvPython> -B <skill>/scripts/office_pkg.py colors <out>`: no `OFF-PALETTE` colors, unless the user asked for them, and no `THEME` line (the theme step was skipped).
3. `<venvPython> -B <skill>/scripts/xlsx_inspect.py check <out>`: no error values and no formulas pointing at missing sheets.
4. `xlsx_inspect.py summary <out>`: read it back against the request (sheets, headers, row counts, formats, charts).
5. `<python> -B <skill>/scripts/office_render.py <out> <work>/render/<slug>` writes one PNG per printed page through LibreOffice, which recalculates on load, so the pages show computed values. Look at every page: the logo, the header row, number formats, and charts. If the script exits 2 (LibreOffice or a rasterizer is missing), or you cannot view images, tell the user that the workbook was checked structurally only.

## Not in this version

Formula results without Excel or LibreOffice, pivot tables, sparklines, slicers, shapes, editing macros, and legacy `.xls` files.
