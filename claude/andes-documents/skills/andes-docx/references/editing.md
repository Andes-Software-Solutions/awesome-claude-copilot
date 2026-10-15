# Editing existing Word documents

python-docx edits the document's own XML and keeps everything it does not touch: styles, sections, headers, footers, images, and fields.

## Before you edit

1. Run `docx_inspect.py <in> --json` and note the style names the document uses. A non-Andes document has its own styles, and you keep them.
2. If the file is `.docm`, never enable or run its macros. python-docx can open `.docx` only; tell the user if the file is legacy `.doc`.
3. Decide the output path. The input is never overwritten.

## Common edits with python-docx

```python
from docx import Document
doc = Document("<in>.docx")

# Append, using the document's existing styles by name.
doc.add_heading("Next steps", level=1)
doc.add_paragraph("Confirm the Q4 targets.", style="List Bullet")

# Insert before a known paragraph (python-docx has no insert-after).
target = next(p for p in doc.paragraphs if p.text.startswith("Appendix"))
target.insert_paragraph_before("New section text", style="Normal")

# Change a table cell, keeping the cell's paragraph formatting.
cell = doc.tables[0].cell(1, 2)
cell.paragraphs[0].runs[0].text = "150,500"

doc.core_properties.title = doc.core_properties.title or "Quarterly report"
doc.save("<out>.docx")
```

- **Deleting a paragraph.** `p._element.getparent().remove(p._element)`. Never delete the last paragraph of a table cell, because a cell must keep one.
- **Run formatting.** Setting `run.text` keeps the run's formatting, while `paragraph.text = …` replaces every run with one plain run. Use `docx_edit.py replace` when the text spans runs.
- **Styles that do not exist.** `style="Heading 2"` raises a `KeyError` when the document lacks the style. Check `[s.name for s in doc.styles]` first.

## Comments

`docx_edit.py comment` anchors one comment on each paragraph that contains the search text, under the author you pass. Use the user's name, not the assistant's. In python-docx 1.2:

```python
doc.add_comment(paragraph.runs, text="Source for 12%?", author="Ana Díaz", initials="AD")
```

## After you edit

Run `office_pkg.py check`, `docx_inspect.py`, and `office_pkg.py text` on the output, and compare with the input. Nothing outside the requested change should differ.
