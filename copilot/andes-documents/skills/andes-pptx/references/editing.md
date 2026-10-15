# Editing existing decks

python-pptx edits the deck's own XML and keeps masters, layouts, media, and charts it does not touch.

## Before you edit

1. Run `pptx_inspect.py <in> --json` and note the layout names. A non-Andes deck keeps its own masters and layouts.
2. Never enable or run macros in a `.pptm`. Legacy `.ppt` files cannot be opened; tell the user.
3. Decide the output path. The input is never overwritten.

## Common edits with python-pptx

```python
from pptx import Presentation
from pptx.util import Pt
prs = Presentation("<in>.pptx")

# Add a slide on one of the deck's own layouts, then fill its placeholders.
layout = next(l for l in prs.slide_layouts if l.name == "ANDES_CONTENT")
slide = prs.slides.add_slide(layout)
for ph in slide.placeholders:
    print(ph.placeholder_format.idx, ph.placeholder_format.type, ph.name)

# Change text, keeping the run's formatting.
shape = next(s for s in prs.slides[2].shapes if s.has_text_frame and "Q3" in s.text_frame.text)
shape.text_frame.paragraphs[0].runs[0].text = "Q3 update"

# Change a chart's data (keeps its formatting).
from pptx.chart.data import CategoryChartData
chart = next(s for s in prs.slides[3].shapes if s.has_chart).chart
data = CategoryChartData()
data.categories = ["North", "South"]
data.add_series("Q3", (150500, 99000))
chart.replace_data(data)

prs.save("<out>.pptx")
```

- Placeholders on PptxGenJS decks are numbered from 100, so look them up by type or name, not by index 0 or 1.
- Setting `text_frame.text = …` replaces every run with one plain run. Use `pptx_edit.py replace` to keep the formatting.
- After `add_slide` on an Andes layout, fill every placeholder it creates, or delete the ones you do not need (`ph._element.getparent().remove(ph._element)`), because an empty placeholder shows its prompt text in edit mode.

## After you edit

Run `office_pkg.py check`, `pptx_inspect.py`, and `office_pkg.py text` on the output, and compare with the input. Nothing outside the requested change should differ.
