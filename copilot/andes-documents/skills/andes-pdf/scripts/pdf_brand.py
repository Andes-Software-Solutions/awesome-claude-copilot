"""Andes branding for ReportLab: embedded brand fonts, the Andes logo, paragraph styles, page templates, tables, and charts.

Import it from a build script in the work folder:

    import sys; sys.path.insert(0, r"<skill>/scripts")
    import pdf_brand as ab
    doc = ab.document(out, title="Quarterly report")
    story = ab.cover("Quarterly report", "Q3 pipeline review", "Finance · October 2026")
    story += [ab.heading("Summary", 1), ab.para("Pipeline grew 12%.")]
    ab.build(doc, story)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import STATE_DEFAULTS, Drawing
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, ListFlowable, ListItem, NextPageTemplate,
                                PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent.parent
BRAND = json.loads((ROOT / "assets" / "brand.json").read_text(encoding="utf-8"))
FONT_DIR = ROOT / "assets" / "fonts"
# Copies of andes-core's andes-brand logos; the audit keeps them identical.
LOGO_DIR = ROOT / "assets" / "logo"
MAX_SERIES = 5

SIDE, TOP, BOTTOM = 0.85 * inch, 0.95 * inch, 0.9 * inch
COVER_BAND = 4.4 * inch


def _draw_logo(c, name: str, x: float, y: float, *, width: float | None = None, height: float | None = None) -> None:
    """Draw a logo file with its bottom-left corner at (x, y), sized by width or height at its own ratio."""
    path = str(LOGO_DIR / name)
    iw, ih = ImageReader(path).getSize()
    width = width if width is not None else height * iw / ih
    height = height if height is not None else width * ih / iw
    c.drawImage(path, x, y, width=width, height=height, mask="auto")


def color(role: str) -> colors.Color:
    return colors.HexColor(BRAND["colors"][role]["hex"])


def series_colors() -> list[colors.Color]:
    return [color(role) for role in BRAND["series"]]


_FONTS: dict[str, str] | None = None


def register_fonts() -> dict[str, str]:
    """Register the bundled Inter and Montserrat; fall back to Helvetica with a warning."""
    global _FONTS
    if _FONTS is not None:
        return _FONTS
    files = {"Inter": "Inter-Regular.ttf", "Inter-Bold": "Inter-Bold.ttf", "Inter-Italic": "Inter-Italic.ttf",
             "Montserrat-Bold": "Montserrat-Bold.ttf"}
    missing = [f for f in files.values() if not (FONT_DIR / f).is_file()]
    if missing:
        print(f"warning: missing {', '.join(missing)} in {FONT_DIR}; using Helvetica, so the PDF is off-brand", file=sys.stderr)
        _FONTS = {"body": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "heading": "Helvetica-Bold"}
        return _FONTS
    for name, file in files.items():
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
    # ReportLab writes its default graphics font (Times-Roman) into every drawing, used or not,
    # and that would leave a non-embedded font in the file.
    STATE_DEFAULTS["fontName"] = "Inter"
    pdfmetrics.registerFontFamily("Inter", normal="Inter", bold="Inter-Bold", italic="Inter-Italic", boldItalic="Inter-Bold")
    pdfmetrics.registerFontFamily("Montserrat", normal="Montserrat-Bold", bold="Montserrat-Bold",
                                  italic="Montserrat-Bold", boldItalic="Montserrat-Bold")
    _FONTS = {"body": "Inter", "bold": "Inter-Bold", "italic": "Inter-Italic", "heading": "Montserrat-Bold"}
    return _FONTS


def styles() -> dict[str, ParagraphStyle]:
    f = register_fonts()
    body = ParagraphStyle("body", fontName=f["body"], fontSize=10, leading=14.5, textColor=color("body"), spaceAfter=6)
    return {
        "title": ParagraphStyle("title", fontName=f["heading"], fontSize=26, leading=32, textColor=color("primary"), spaceAfter=10),
        "h1": ParagraphStyle("h1", fontName=f["heading"], fontSize=18, leading=24, textColor=color("primary"),
                             spaceBefore=18, spaceAfter=6, keepWithNext=1),
        "h2": ParagraphStyle("h2", fontName=f["heading"], fontSize=13.5, leading=18, textColor=color("primary"),
                             spaceBefore=14, spaceAfter=4, keepWithNext=1),
        "h3": ParagraphStyle("h3", fontName=f["bold"], fontSize=11, leading=15, textColor=color("emphasis"),
                             spaceBefore=10, spaceAfter=3, keepWithNext=1),
        "body": body,
        "small": ParagraphStyle("small", parent=body, fontSize=8.5, leading=12, textColor=color("secondary")),
        "caption": ParagraphStyle("caption", parent=body, fontName=f["italic"], fontSize=8.5, leading=12,
                                  textColor=color("secondary"), spaceBefore=4, spaceAfter=12),
        "th": ParagraphStyle("th", fontName=f["bold"], fontSize=9, leading=12, textColor=color("page")),
        "th_num": ParagraphStyle("th_num", fontName=f["bold"], fontSize=9, leading=12, textColor=color("page"), alignment=TA_RIGHT),
        "td": ParagraphStyle("td", fontName=f["body"], fontSize=9, leading=12, textColor=color("body")),
        "td_num": ParagraphStyle("td_num", fontName=f["body"], fontSize=9, leading=12, textColor=color("body"), alignment=TA_RIGHT),
        "cover_title": ParagraphStyle("cover_title", fontName=f["heading"], fontSize=30, leading=36, textColor=color("page")),
        "cover_subtitle": ParagraphStyle("cover_subtitle", fontName=f["body"], fontSize=14, leading=19, textColor=color("accent"), spaceBefore=10),
        "cover_meta": ParagraphStyle("cover_meta", fontName=f["body"], fontSize=10, leading=14, textColor=color("page"), spaceBefore=18),
        "toc1": ParagraphStyle("toc1", fontName=f["bold"], fontSize=10.5, leading=16, textColor=color("primary")),
        "toc2": ParagraphStyle("toc2", fontName=f["body"], fontSize=10, leading=14, leftIndent=14, textColor=color("body")),
    }


_STYLES: dict[str, ParagraphStyle] = {}


def style(name: str) -> ParagraphStyle:
    if not _STYLES:
        _STYLES.update(styles())
    return _STYLES[name]


def para(text: str, name: str = "body") -> Paragraph:
    """A paragraph in an Andes style. text uses ReportLab markup (<b>, <i>, <a href>), so escape &, <, >."""
    return Paragraph(text, style(name))


def heading(text: str, level: int = 1) -> Paragraph:
    return Paragraph(text, style(f"h{level}"))


def link(text: str, url: str) -> str:
    """Inline markup for a navy, underlined link; use inside para()."""
    return f'<a href="{url}" color="{BRAND["colors"]["primary"]["hex"]}"><u>{text}</u></a>'


def bullets(items: list[str], numbered: bool = False) -> ListFlowable:
    return ListFlowable(
        [ListItem(para(t), leftIndent=14) for t in items],
        bulletType="1" if numbered else "bullet",
        start=None if numbered else "•",
        bulletColor=color("primary"),
        bulletFontName=register_fonts()["bold"] if numbered else register_fonts()["body"],
        bulletFontSize=9.5,
        leftIndent=14,
    )


def _cell_font() -> tuple:
    # A Table sets its cell font (Helvetica unless told) even when every cell holds a Paragraph,
    # which leaves a non-embedded font in the file.
    return ("FONTNAME", (0, 0), (-1, -1), register_fonts()["body"])


def toc() -> TableOfContents:
    t = TableOfContents()
    t.levelStyles = [style("toc1"), style("toc2")]
    t.tableStyle = TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0), _cell_font()])
    return t


def cover(title: str, subtitle: str | None = None, meta: str | None = None) -> list:
    """Flowables for the cover page; the next page switches to the body template."""
    out = [Paragraph(title, style("cover_title"))]
    if subtitle:
        out.append(Paragraph(subtitle, style("cover_subtitle")))
    if meta:
        out.append(Paragraph(meta, style("cover_meta")))
    return out + [NextPageTemplate("body"), PageBreak()]


def table(header: list[str], rows: list[list], *, col_widths: list[float] | None = None,
          numeric_cols: tuple[int, ...] = (), zebra: bool = True) -> Table:
    """A table whose header row repeats on every page. Cell text uses ReportLab markup."""
    cells = [[Paragraph(str(h), style("th_num" if j in numeric_cols else "th")) for j, h in enumerate(header)]]
    for r in rows:
        cells.append([Paragraph("" if v is None else str(v), style("td_num" if j in numeric_cols else "td")) for j, v in enumerate(r)])
    t = Table(cells, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    commands = [
        _cell_font(),
        ("BACKGROUND", (0, 0), (-1, 0), color("primary")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, color("accent")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, color("border")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for j in numeric_cols:
        commands.append(("ALIGN", (j, 0), (j, -1), "RIGHT"))
    if zebra:
        commands += [("BACKGROUND", (0, i), (-1, i), color("surfaceSubtle")) for i in range(2, len(cells), 2)]
    t.setStyle(TableStyle(commands))
    return t


CALLOUTS = {"info": ("accentStrong", "Note"), "success": ("success", "Result"),
            "warning": ("warning", "Warning"), "danger": ("danger", "Important")}


def callout(text: str, kind: str = "info", label: str | None = None, width: float | None = None) -> Table:
    """A shaded box with a colored left rule. The bold label carries the meaning, not the color."""
    role, default_label = CALLOUTS[kind]
    t = Table([[para(f"<b>{label or default_label}:</b> {text}")]], colWidths=[width] if width else None, hAlign="LEFT")
    t.setStyle(TableStyle([
        _cell_font(),
        ("BACKGROUND", (0, 0), (-1, -1), color("surface")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, color(role)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def _warn_series(n: int, what: str) -> None:
    if n > MAX_SERIES:
        print(f"warning: {n} {what}; group the rest as 'Other' (Slate) to stay within {MAX_SERIES}", file=sys.stderr)


def _legend(drawing: Drawing, names: list[str], x: float, y: float) -> None:
    f = register_fonts()
    legend = Legend()
    legend.x, legend.y = x, y
    legend.alignment = "right"
    legend.columnMaximum = 1
    legend.deltax = 0
    legend.dx = legend.dy = 8
    legend.fontName, legend.fontSize = f["body"], 8.5
    legend.fillColor = color("body")
    legend.boxAnchor = "sw"
    legend.dxTextSpace = 5
    legend.colorNamePairs = list(zip(series_colors(), names))
    legend.columnMaximum = len(names)
    legend.deltay = 12
    drawing.add(legend)


def _style_axes(chart, value_format: str) -> None:
    f = register_fonts()
    chart.valueAxis.labels.fontName = f["body"]
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labels.fillColor = color("secondary")
    chart.valueAxis.labelTextFormat = lambda v: value_format.format(v)
    chart.valueAxis.strokeColor = color("border")
    chart.valueAxis.visibleGrid = 1
    chart.valueAxis.gridStrokeColor = color("border")
    chart.valueAxis.gridStrokeWidth = 0.5
    chart.valueAxis.valueMin = 0
    chart.categoryAxis.labels.fontName = f["body"]
    chart.categoryAxis.labels.fontSize = 8.5
    chart.categoryAxis.labels.fillColor = color("body")
    chart.categoryAxis.strokeColor = color("secondary")


def bar_chart(categories: list[str], series: dict[str, list[float]], *, width: float = 6.5 * inch,
              height: float = 3 * inch, horizontal: bool = False, value_format: str = "{:,.0f}") -> Drawing:
    _warn_series(len(series), "series")
    names = list(series)
    legend_w = 1.3 * inch if len(names) > 1 else 0
    d = Drawing(width, height)
    chart = HorizontalBarChart() if horizontal else VerticalBarChart()
    chart.x, chart.y = 0.6 * inch, 0.35 * inch
    chart.width, chart.height = width - chart.x - legend_w - 0.15 * inch, height - chart.y - 0.15 * inch
    chart.data = [series[n] for n in names]
    chart.categoryAxis.categoryNames = categories
    chart.groupSpacing, chart.barSpacing = 8, 1.5
    for i, c in enumerate(series_colors()[:len(names)]):
        chart.bars[i].fillColor = c
        chart.bars[i].strokeColor = None
    _style_axes(chart, value_format)
    d.add(chart)
    if legend_w:
        _legend(d, names, width - legend_w + 0.1 * inch, chart.y + chart.height / 2)
    return d


def line_chart(categories: list[str], series: dict[str, list[float]], *, width: float = 6.5 * inch,
               height: float = 3 * inch, value_format: str = "{:,.0f}") -> Drawing:
    _warn_series(len(series), "series")
    names = list(series)
    legend_w = 1.3 * inch if len(names) > 1 else 0
    d = Drawing(width, height)
    chart = HorizontalLineChart()
    chart.x, chart.y = 0.6 * inch, 0.35 * inch
    chart.width, chart.height = width - chart.x - legend_w - 0.15 * inch, height - chart.y - 0.15 * inch
    chart.data = [series[n] for n in names]
    chart.categoryAxis.categoryNames = categories
    chart.joinedLines = 1
    for i, c in enumerate(series_colors()[:len(names)]):
        chart.lines[i].strokeColor = c
        chart.lines[i].strokeWidth = 2
        chart.lines[i].symbol = makeMarker("FilledCircle", size=5, fillColor=c, strokeColor=c)
    _style_axes(chart, value_format)
    d.add(chart)
    if legend_w:
        _legend(d, names, width - legend_w + 0.1 * inch, chart.y + chart.height / 2)
    return d


def pie_chart(labels: list[str], values: list[float], *, width: float = 6.5 * inch, height: float = 2.8 * inch) -> Drawing:
    _warn_series(len(values), "slices")
    f = register_fonts()
    total = sum(values) or 1
    d = Drawing(width, height)
    pie = Pie()
    size = height - 0.4 * inch
    pie.x, pie.y, pie.width, pie.height = 0.3 * inch, 0.2 * inch, size, size
    pie.data = values
    pie.labels = None
    pie.slices.strokeColor = color("page")
    pie.slices.strokeWidth = 1.5
    for i, c in enumerate(series_colors()[:len(values)]):
        pie.slices[i].fillColor = c
    d.add(pie)
    names = [f"{l}  {v / total:.0%}" for l, v in zip(labels, values)]
    _legend(d, names, pie.x + size + 0.5 * inch, pie.y + size / 2)
    d.contents[-1].alignment = "right"
    d.contents[-1].fontName = f["body"]
    return d


def figure(drawing, caption: str | None = None) -> KeepTogether:
    """A chart or image with its caption, kept on one page."""
    items = [drawing]
    if caption:
        items.append(para(caption, "caption"))
    return KeepTogether(items)


class AndesDoc(BaseDocTemplate):
    """Adds PDF bookmarks and table-of-contents entries for every h1 and h2."""

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name in ("h1", "h2"):
            # The outline cannot skip a level, so an H2 before any H1 (a one-pager) becomes top level.
            # Each multiBuild pass draws on a new canvas, which starts a new outline.
            if getattr(self, "_outline_canv", None) is not self.canv:
                self._outline_canv, self._outline_level = self.canv, -1
            level = min(0 if flowable.style.name == "h1" else 1, self._outline_level + 1)
            self._outline_level = level
            text = flowable.getPlainText()
            key = f"h{self.seq.nextf('heading')}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
            self.notify("TOCEntry", (level, text, self.page, key))


def document(path, *, title: str, author: str | None = None, subject: str | None = None,
             lang: str | None = None, pagesize: str | None = None, landscape: bool = False,
             header_text: str | None = None, footer_text: str | None = None, cover_page: bool = True) -> AndesDoc:
    """A Letter (or A4) document with a navy cover template and a body template. The cover carries the
    full Andes logo on its white part, and every body page the Andes mark at the left of the header.

    header_text defaults to the title; footer_text is appended to the company name (e.g. 'Internal').
    """
    f = register_fonts()
    size = {"letter": LETTER, "a4": A4}[(pagesize or BRAND["defaults"]["pageSize"]).lower()]
    if landscape:
        size = (size[1], size[0])
    w, h = size
    doc = AndesDoc(str(path), pagesize=size, leftMargin=SIDE, rightMargin=SIDE, topMargin=TOP, bottomMargin=BOTTOM,
                   title=title, author=author or BRAND["company"], subject=subject or "", creator=BRAND["company"],
                   lang=lang or BRAND["defaults"]["lang"])
    header = header_text if header_text is not None else title
    footer = " · ".join(x for x in (BRAND["company"], footer_text) if x)

    def draw_cover(c, _doc):
        c.saveState()
        c.setFillColor(color("primary"))
        c.rect(0, h - COVER_BAND, w, COVER_BAND, stroke=0, fill=1)
        c.setFillColor(color("accent"))
        c.rect(SIDE, h - COVER_BAND - 0.12 * inch, 1.6 * inch, 0.06 * inch, stroke=0, fill=1)
        _draw_logo(c, "andes-logo.png", SIDE, BOTTOM + 0.15 * inch, width=2.2 * inch)
        c.setFont(f["body"], 9)
        c.setFillColor(color("secondary"))
        c.drawString(SIDE, BOTTOM - 0.35 * inch, BRAND["company"])
        c.restoreState()

    def draw_body(c, _doc):
        c.saveState()
        c.setFont(f["body"], 8.5)
        c.setFillColor(color("secondary"))
        c.drawRightString(w - SIDE, h - TOP + 0.35 * inch, header)
        _draw_logo(c, "andes-mark.png", SIDE, h - TOP + 0.31 * inch, height=0.25 * inch)
        c.setStrokeColor(color("accent"))
        c.setLineWidth(0.75)
        c.line(SIDE, h - TOP + 0.25 * inch, w - SIDE, h - TOP + 0.25 * inch)
        c.drawString(SIDE, BOTTOM - 0.4 * inch, footer)
        c.restoreState()

    cover_frame = Frame(SIDE, h - COVER_BAND + 0.5 * inch, w - 2 * SIDE, COVER_BAND - 1.1 * inch, id="cover", showBoundary=0)
    body_frame = Frame(SIDE, BOTTOM, w - 2 * SIDE, h - TOP - BOTTOM, id="body", showBoundary=0)
    templates = [PageTemplate("cover", [cover_frame], onPage=draw_cover), PageTemplate("body", [body_frame], onPage=draw_body)]
    doc.addPageTemplates(templates if cover_page else templates[::-1])
    doc.andes_fonts = f
    return doc


def _numbered_canvas(doc: AndesDoc):
    """A canvas that writes 'Page n of m' on body pages once the page count is known."""
    f = doc.andes_fonts
    w = doc.pagesize[0]

    class NumberedCanvas(rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            # Without this the canvas starts every page in Helvetica, which is never embedded.
            # The doc template passes initialFontName=None explicitly, so setdefault is not enough.
            kwargs["initialFontName"] = kwargs.get("initialFontName") or f["body"]
            super().__init__(*args, **kwargs)
            self._saved_pages = []
            self.setViewerPreference("DisplayDocTitle", "true")

        def showPage(self):
            self._saved_pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_pages)
            for number, state in enumerate(self._saved_pages, 1):
                self.__dict__.update(state)
                if number > 1 or doc.pageTemplates[0].id == "body":
                    self.saveState()
                    self.setFont(f["body"], 8.5)
                    self.setFillColor(color("secondary"))
                    self.drawRightString(w - SIDE, BOTTOM - 0.4 * inch, f"Page {number} of {total}")
                    self.restoreState()
                super().showPage()
            super().save()

    return NumberedCanvas


def _keep_headings_with_next(story: list) -> list:
    # ReportLab's keepWithNext skips container flowables, so a heading followed by figure() or
    # callout() could end a page alone. Group each run of headings with what follows it.
    out, pending = [], []
    for f in story:
        if isinstance(f, Paragraph) and getattr(f.style, "keepWithNext", 0):
            pending.append(f)
            continue
        if pending:
            out.append(KeepTogether(pending + (list(f._content) if isinstance(f, KeepTogether) else [f])))
            pending = []
        else:
            out.append(f)
    return out + pending


def build(doc: AndesDoc, story: list) -> None:
    """Build in as many passes as the table of contents needs."""
    doc.multiBuild(_keep_headings_with_next(story), canvasmaker=_numbered_canvas(doc))
