# Workbook patterns

Load this when the workbook is more than one table. Every snippet assumes `brand = load_brand()` and `rgb(brand, role)` from `xlsx_brand`.

## Data export

- One table per sheet, header in row 1, and `write_table(ws, "A1", …, band=False)` so the banding does not hide in a downstream import.
- Use a number format for every numeric column, with dates as real `datetime` values (never strings) and the `date` format.
- Name the sheet after its content (`Invoices`, not `Sheet1`). Sheet names cannot be over 31 characters or contain `[]:*?/\`.

## Tracker

Use a status column with a drop-down, conditional formatting that never relies on color alone, and a frozen header.

```python
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font, PatternFill

status = DataValidation(type="list", formula1='"Not started,In progress,Blocked,Done"', allow_blank=True)
ws.add_data_validation(status)
status.add("C2:C500")

ws.conditional_formatting.add("A2:F500", FormulaRule(
    formula=['$C2="Blocked"'], font=Font(color=rgb(brand, "danger"), bold=True)))
ws.conditional_formatting.add("A2:F500", FormulaRule(
    formula=['$C2="Done"'], font=Font(color=rgb(brand, "secondary"))))
```

The status text itself carries the meaning, and the color only reinforces it. For progress, a data bar in `accentStrong` reads well on white:

```python
from openpyxl.formatting.rule import DataBarRule
ws.conditional_formatting.add("E2:E500", DataBarRule(
    start_type="num", start_value=0, end_type="num", end_value=1, color=rgb(brand, "accentStrong")))
```

## KPI or financial model

Split the model into three sheets, in this order:

| Sheet | Holds | Style |
| --- | --- | --- |
| `Inputs` | Every assumption, one per row: label, value, unit, source | Values in `Andes Input`; the source note in `Andes Note` |
| `Model` | Formulas only, referring to `Inputs` by defined name | `Andes Body`; subtotals in `Andes Total` |
| `Summary` | The few figures a reader needs, plus charts | `Andes Title` in A1, gridlines hidden |

```python
from openpyxl.workbook.defined_name import DefinedName
inputs["A2"], inputs["B2"], inputs["C2"] = "Annual growth", 0.08, "%"
inputs["B2"].style = "Andes Input"
inputs["B2"].number_format = FORMATS["pct"]
wb.defined_names["Growth"] = DefinedName("Growth", attr_text="Inputs!$B$2")
model["C5"] = "=B5*(1+Growth)"
```

- Never put a hard-coded number inside a formula (`=B5*1.08`). Give it an input row instead.
- Keep each formula row consistent: the same formula, filled across.
- Note the units in the header (`Revenue (USD thousands)`) instead of in every cell.
- Negative values use the `acct` format, which shows them in parentheses.

## Links and notes

```python
from openpyxl.styles import Font
cell.hyperlink = "https://example.com/report"
cell.font = Font(name=brand["fonts"]["office"]["body"], color=rgb(brand, "primary"), underline="single")
```

Do not use the built-in `Hyperlink` style, because its blue is not an Andes color. Use `Andes Note` for footnotes under a table, and cell comments only for reviewer notes.

## Print layout

`print_setup(ws)` sets landscape, Letter (or A4 from `brand.json`), fit to one page wide, the header row repeated, the company in the left footer, and `Page n of m` on the right. For a summary sheet, also set `ws.print_area = "A1:H40"`.
