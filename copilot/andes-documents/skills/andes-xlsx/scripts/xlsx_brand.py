"""Andes branding for openpyxl workbooks: named cell styles, branded tables, and charts in the brand series order.

Import it from a build script in the work folder:

    import sys; sys.path.insert(0, r"<skill>/scripts")
    from xlsx_brand import new_workbook, write_table, add_chart, autosize_columns
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.axis import ChartLines
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.series import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.styles import Alignment, Border, Font, NamedStyle, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import coordinate_to_tuple, range_boundaries

BRAND_PATH = Path(__file__).resolve().parent.parent / "assets" / "brand.json"

FORMATS = {
    "int": "#,##0",
    "dec": "#,##0.00",
    "pct": "0.0%",
    "usd": '"$"#,##0.00',
    "acct": "#,##0.00_);(#,##0.00)",
    "date": "yyyy-mm-dd",
    "datetime": "yyyy-mm-dd hh:mm",
    "text": "@",
}
SUMMABLE = {"int", "dec", "usd", "acct"}
MAX_SERIES = 5


def load_brand(path: Path | None = None) -> dict:
    with open(path or BRAND_PATH, encoding="utf-8") as f:
        return json.load(f)


def rgb(brand: dict, role: str) -> str:
    return "FF" + brand["colors"][role]["hex"].lstrip("#").upper()


def ensure_styles(wb: Workbook, brand: dict | None = None) -> None:
    """Register the Andes named styles once; safe on workbooks opened for editing."""
    brand = brand or load_brand()
    heading, body = brand["fonts"]["office"]["heading"], brand["fonts"]["office"]["body"]
    rule = Side(style="thin", color=rgb(brand, "border"))
    styles = {
        "Andes Title": dict(font=Font(name=heading, size=16, bold=True, color=rgb(brand, "primary"))),
        "Andes Header": dict(
            font=Font(name=heading, size=11, bold=True, color=rgb(brand, "page")),
            fill=PatternFill("solid", fgColor=rgb(brand, "primary")),
            alignment=Alignment(horizontal="center", vertical="center", wrap_text=True),
            border=Border(bottom=Side(style="medium", color=rgb(brand, "accent"))),
        ),
        "Andes Body": dict(font=Font(name=body, size=11, color=rgb(brand, "body")), border=Border(bottom=rule)),
        "Andes Input": dict(
            font=Font(name=body, size=11, color=rgb(brand, "primary")),
            fill=PatternFill("solid", fgColor=rgb(brand, "surfaceAlt")),
            border=Border(left=rule, right=rule, top=rule, bottom=rule),
        ),
        "Andes Total": dict(
            font=Font(name=body, size=11, bold=True, color=rgb(brand, "emphasis")),
            border=Border(top=Side(style="thin", color=rgb(brand, "primary")), bottom=Side(style="double", color=rgb(brand, "primary"))),
        ),
        "Andes Note": dict(font=Font(name=body, size=9, italic=True, color=rgb(brand, "secondary"))),
    }
    existing = set(wb.named_styles)
    for name, attrs in styles.items():
        if name not in existing:
            wb.add_named_style(NamedStyle(name=name, **attrs))


def new_workbook(brand: dict | None = None, *, title: str | None = None, creator: str | None = None) -> Workbook:
    brand = brand or load_brand()
    wb = Workbook()
    ensure_styles(wb, brand)
    wb.properties.creator = creator or brand["company"]
    if title:
        wb.properties.title = title
    # openpyxl stores formulas without results; Excel computes them when the file opens.
    wb.calculation.fullCalcOnLoad = True
    return wb


def write_table(ws, top_left: str, header: list[str], rows: list[list], *, formats: dict[int, str] | None = None,
                total_row: bool = False, freeze: bool = True, autofilter: bool = True, band: bool = True,
                brand: dict | None = None) -> str:
    """Write a header row and data rows with Andes styles. Returns the range written, e.g. 'A1:D20'.

    formats maps a zero-based column index to a FORMATS key or a literal Excel number format.
    total_row appends a SUM row for every column formatted as int, dec, usd, or acct.
    """
    brand = brand or load_brand()
    ensure_styles(ws.parent, brand)
    formats = formats or {}
    row0, col0 = coordinate_to_tuple(top_left)
    band_fill = PatternFill("solid", fgColor=rgb(brand, "surfaceSubtle"))
    for j, h in enumerate(header):
        ws.cell(row0, col0 + j, h).style = "Andes Header"
    for i, values in enumerate(rows, 1):
        for j, v in enumerate(values):
            c = ws.cell(row0 + i, col0 + j, v)
            c.style = "Andes Body"
            if band and i % 2 == 0:
                c.fill = band_fill
            if j in formats:
                c.number_format = FORMATS.get(formats[j], formats[j])
    last_row = row0 + len(rows)
    last_col = col0 + len(header) - 1
    if total_row:
        r = last_row + 1
        ws.cell(r, col0, "Total").style = "Andes Total"
        for j in range(1, len(header)):
            c = ws.cell(r, col0 + j)
            c.style = "Andes Total"
            if formats.get(j) in SUMMABLE:
                letter = get_column_letter(col0 + j)
                c.value = f"=SUM({letter}{row0 + 1}:{letter}{last_row})"
                c.number_format = FORMATS[formats[j]]
    ref = f"{get_column_letter(col0)}{row0}:{get_column_letter(last_col)}{last_row}"
    if autofilter:
        ws.auto_filter.ref = ref
    if freeze:
        ws.freeze_panes = ws.cell(row0 + 1, col0)
    return ref


def add_chart(ws, kind: str, data_ref: str, cats_ref: str, anchor: str, *, title: str,
              y_title: str | None = None, x_title: str | None = None, brand: dict | None = None,
              width_cm: float = 18, height_cm: float = 9):
    """Add a bar, column, line, or pie chart colored in the brand series order.

    data_ref includes the header row (series names come from it); cats_ref excludes it.
    """
    brand = brand or load_brand()
    colors = [brand["colors"][role]["hex"].lstrip("#").upper() for role in brand["series"]]
    min_col, min_row, max_col, max_row = range_boundaries(data_ref)
    data = Reference(ws, min_col=min_col, min_row=min_row, max_col=max_col, max_row=max_row)
    c_min_col, c_min_row, c_max_col, c_max_row = range_boundaries(cats_ref)
    cats = Reference(ws, min_col=c_min_col, min_row=c_min_row, max_col=c_max_col, max_row=c_max_row)

    if kind in ("bar", "column"):
        chart = BarChart()
        chart.type = "bar" if kind == "bar" else "col"
        chart.gapWidth = 60
    elif kind == "line":
        chart = LineChart()
    elif kind == "pie":
        chart = PieChart()
    else:
        raise ValueError(f"unknown chart kind {kind!r}; use bar, column, line, or pie")

    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.title = title
    chart.width, chart.height = width_cm, height_cm
    chart.legend.position = "b"

    if len(chart.series) > MAX_SERIES:
        print(f"warning: {len(chart.series)} series; Andes charts show at most {MAX_SERIES}. "
              "Group the rest as 'Other' or split the chart.", file=sys.stderr)

    if kind == "pie":
        points = max_row - min_row
        if points > MAX_SERIES:
            print(f"warning: {points} slices; group small ones as 'Other' (Slate).", file=sys.stderr)
        s = chart.series[0]
        for i in range(points):
            pt = DataPoint(idx=i)
            pt.graphicalProperties.solidFill = colors[i % len(colors)]
            pt.graphicalProperties.line.solidFill = rgb(brand, "page")[2:]
            s.dPt.append(pt)
        chart.dataLabels = DataLabelList()
        chart.dataLabels.showPercent = True
        return _place(ws, chart, anchor)

    for i, s in enumerate(chart.series):
        color = colors[i % len(colors)]
        if kind == "line":
            s.graphicalProperties.line.solidFill = color
            s.graphicalProperties.line.width = 28575  # 2.25 pt
            s.marker.symbol = "circle"
            s.marker.size = 6
            s.marker.graphicalProperties.solidFill = color
            s.marker.graphicalProperties.line.solidFill = color
            s.smooth = False
        else:
            s.graphicalProperties.solidFill = color
            s.graphicalProperties.line.solidFill = color
    if y_title:
        chart.y_axis.title = y_title
    if x_title:
        chart.x_axis.title = x_title
    # openpyxl 3.1 marks axes deleted unless told otherwise, and Excel then draws none.
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    gridline = brand["colors"]["border"]["hex"].lstrip("#").upper()
    chart.y_axis.majorGridlines = ChartLines(spPr=GraphicalProperties(ln=LineProperties(solidFill=gridline)))
    return _place(ws, chart, anchor)


def _place(ws, chart, anchor: str):
    ws.add_chart(chart, anchor)
    return chart


def autosize_columns(ws, min_width: float = 8, max_width: float = 60) -> None:
    widths: dict[int, int] = {}
    for row in ws.iter_rows():
        for c in row:
            if c.value is None:
                continue
            text = str(c.value)
            length = 12 if text.startswith("=") else max(len(line) for line in text.splitlines() or [""])
            widths[c.column] = max(widths.get(c.column, 0), length)
    for col, length in widths.items():
        ws.column_dimensions[get_column_letter(col)].width = max(min_width, min(max_width, length + 2))


def print_setup(ws, *, landscape: bool = True, title_rows: str | None = "1:1", footer: str | None = None,
                brand: dict | None = None) -> None:
    """Fit to one page wide, repeat the header row, and put 'Page n of m' in the footer."""
    brand = brand or load_brand()
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER if brand["defaults"]["pageSize"] == "letter" else ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    if title_rows:
        ws.print_title_rows = title_rows
    ws.oddFooter.left.text = footer or brand["company"]
    ws.oddFooter.right.text = "Page &P of &N"
