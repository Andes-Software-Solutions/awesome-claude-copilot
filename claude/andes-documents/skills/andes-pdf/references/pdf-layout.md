# PDF layouts

Each snippet assumes `import pdf_brand as ab` from the build script in SKILL.md.

## One-pager

No cover and no table of contents. The body template starts on page 1:

```python
doc = ab.document(out, title="Atlas project brief", cover_page=False, footer_text="Confidential")
story = [ab.para("Atlas project brief", "title"), ab.para("October 2026 · Prepared for Contoso", "small"),
         ab.heading("Goal", 2), ab.para("…"),
         ab.heading("Plan", 2), ab.bullets(["…", "…"]),
         ab.callout("Decision needed by October 31.", "warning")]
ab.build(doc, story)
```

Keep a one-pager to one page. If `pdf_tools.py info` reports two, tighten the text before you shrink anything.

## Letter

```python
from reportlab.platypus import Spacer
doc = ab.document(out, title="Letter to Contoso", cover_page=False, header_text="")
story = [ab.para("October 14, 2026", "small"), Spacer(1, 18),
         ab.para("Ana Díaz<br/>Contoso Ltd.<br/>…"), Spacer(1, 18),
         ab.para("Dear Ms. Díaz,"), ab.para("…"), Spacer(1, 24),
         ab.para("Sincerely,"), Spacer(1, 36), ab.para("<b>Name</b><br/>Title")]
ab.build(doc, story)
```

`header_text=""` leaves the header line with no title in it.

## Landscape pages and wide tables

```python
doc = ab.document(out, title="Regional detail", cover_page=False, landscape=True)
```

A document has one orientation. For a landscape appendix to a portrait report, build it as its own PDF and `merge` the two.

## Images

```python
from reportlab.platypus import Image
img = Image("<work>/map.png", width=6.5 * 72, height=3.2 * 72)
story.append(ab.figure(img, "Figure 2. Regional coverage"))
```

- Use PNG or JPEG. Size the image to the text width at most: 6.8 inches on Letter with these margins.
- Describe the image's takeaway in the surrounding text or the caption, because the PDF is not tagged.

## Numbers and dates

Format numbers before you put them in a table (`f"{v:,.0f}"`), and pass their column indexes in `numeric_cols` so they right-align. Use one date format per document, such as `October 14, 2026` in prose or `2026-10-14` in tables.
