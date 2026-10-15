"""Outline a Word document and flag structure and accessibility problems.

    python -B docx_inspect.py <file> [--json]

Lists sections (page size, orientation) and every top-level paragraph and table in order, then
flags: skipped heading levels, empty headings, bold Normal paragraphs that act as headings,
drawings without alt text (inline or floating, in the body, headers, and footers; images
marked decorative are exempt), and a missing document title.
Exit codes: 0 clean, 10 flags raised, 1 error.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from docx import Document
from docx.opc.part import XmlPart
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

EMU_PER_INCH = 914400
DRAWING_PARTS = re.compile(r"/word/(document|header\d*|footer\d*)\.xml$")
FILE_NAME_ALT = re.compile(r"^\S+\.(png|jpe?g|gif|bmp|tiff?|svg|emf|wmf|webp)$", re.I)


def drawings(doc):
    """(part file, wp:docPr) for every inline or floating drawing in the body, headers, and footers.

    doc.inline_shapes covers only inline drawings in the body.
    """
    for part in doc.part.package.iter_parts():
        if isinstance(part, XmlPart) and DRAWING_PARTS.search(str(part.partname)):
            for doc_pr in part.element.iter(qn("wp:docPr")):
                yield str(part.partname).rsplit("/", 1)[-1], doc_pr


def decorative(doc_pr) -> bool:
    """Word's 'Mark as decorative' sets an adec:decorative extension, and such images need no alt text."""
    return any(el.tag.endswith("}decorative") and el.get("val") in ("1", "true") for el in doc_pr.iter())


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
    for part_file, doc_pr in drawings(doc):
        descr, name = (doc_pr.get("descr") or "").strip(), doc_pr.get("name") or "unnamed"
        if decorative(doc_pr):
            continue
        if not descr:
            flags.append(f"drawing '{name}' in {part_file} has no alt text")
        elif FILE_NAME_ALT.match(descr):
            flags.append(f"drawing '{name}' in {part_file} has a file name as alt text ('{descr}')")
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
