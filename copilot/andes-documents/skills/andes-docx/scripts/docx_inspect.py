"""Outline a Word document and flag structure and accessibility problems.

    python -B docx_inspect.py <file> [--json]

Lists sections (page size, orientation) and every top-level paragraph and table in order, then
flags: skipped heading levels, empty headings, bold Normal paragraphs that act as headings,
images without alt text, and a missing document title.
Exit codes: 0 clean, 10 flags raised, 1 error.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

EMU_PER_INCH = 914400


def heading_level(p: Paragraph) -> int | None:
    name = p.style.name if p.style is not None else ""
    if name == "Title":
        return 0
    m = re.fullmatch(r"Heading (\d)", name)
    return int(m.group(1)) if m else None


def outline(path: Path) -> dict:
    doc = Document(str(path))
    blocks, flags = [], []
    last_level = 0
    for item in doc.iter_inner_content():
        if isinstance(item, Table):
            blocks.append({"kind": "table", "rows": len(item.rows), "columns": len(item.columns),
                           "header": [c.text for c in item.rows[0].cells] if item.rows else []})
            continue
        level = heading_level(item)
        text = item.text.strip()
        blocks.append({"kind": "paragraph", "style": item.style.name if item.style is not None else None,
                       "level": level, "text": text[:200]})
        if level is not None and level > 0:
            if not text:
                flags.append(f"empty heading (style {item.style.name})")
            if level > last_level + 1:
                flags.append(f"heading level skips from {last_level} to {level}: '{text[:60]}'")
            last_level = level
        elif (text and len(text) < 80 and item.runs and all(r.bold for r in item.runs if r.text.strip())
              and item.style is not None and item.style.name == "Normal"):
            flags.append(f"bold Normal paragraph used as a heading; apply a Heading style: '{text[:60]}'")
    for shape in doc.inline_shapes:
        doc_pr = shape._inline.docPr
        if not (doc_pr.get("descr") or "").strip():
            flags.append(f"image '{doc_pr.get('name')}' has no alt text")
    if not (doc.core_properties.title or "").strip():
        flags.append("document has no title property")
    sections = [{
        "orientation": "landscape" if s.orientation == 1 else "portrait",
        "widthIn": round(s.page_width / EMU_PER_INCH, 2) if s.page_width else None,
        "heightIn": round(s.page_height / EMU_PER_INCH, 2) if s.page_height else None,
    } for s in doc.sections]
    return {"file": str(path), "title": doc.core_properties.title, "sections": sections, "blocks": blocks, "flags": flags}


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    try:
        result = outline(Path(argv[0]))
    except (OSError, ValueError, KeyError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    if "--json" in argv:
        print(json.dumps(result, indent=2))
    else:
        print(f"title: {result['title'] or '(none)'}")
        for i, s in enumerate(result["sections"], 1):
            print(f"section {i}: {s['widthIn']} x {s['heightIn']} in, {s['orientation']}")
        for b in result["blocks"]:
            if b["kind"] == "table":
                print(f"[table {b['rows']}x{b['columns']}] {b['header']}")
            elif b["text"]:
                marker = "#" * b["level"] if b["level"] else ("T" if b["level"] == 0 else "-")
                print(f"{marker} {b['text']}  ({b['style']})")
        for f in result["flags"]:
            print(f"FLAG {f}")
    return 10 if result["flags"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
