"""Edit an existing Word document in place of Word: replace text or add review comments.

    python -B docx_edit.py replace <in> <out> --map <mapping.json>
    python -B docx_edit.py comment <in> <out> --find <text> --text <comment> [--author <name>]

replace swaps every key of a JSON object for its value in the body, tables, headers, and footers.
Text that Word split across runs is still found; the replacement takes the formatting of the run
where the match starts. comment anchors a comment on each paragraph that contains the text.
Exit codes: 0 done, 10 nothing matched, 1 error.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Iterator

from docx import Document
from docx.text.paragraph import Paragraph


def iter_paragraphs(doc) -> Iterator[Paragraph]:
    seen: set[int] = set()

    def walk(container) -> Iterator[Paragraph]:
        for block in container.iter_inner_content():
            if isinstance(block, Paragraph):
                yield block
                continue
            for row in block.rows:
                for cell in row.cells:
                    # Merged cells repeat in row.cells; visit each once.
                    if id(cell._tc) in seen:
                        continue
                    seen.add(id(cell._tc))
                    yield from walk(cell)

    yield from walk(doc)
    for s in doc.sections:
        for part in (s.header, s.footer, s.first_page_header, s.first_page_footer, s.even_page_header, s.even_page_footer):
            if not part.is_linked_to_previous:
                yield from walk(part)


def replace_in_runs(runs, key: str, value: str) -> int:
    count, offset = 0, 0
    while True:
        texts = [r.text for r in runs]
        full = "".join(texts)
        i = full.find(key, offset)
        if i < 0:
            return count
        end, pos, first = i + len(key), 0, True
        for r, t in zip(runs, texts):
            start, stop = pos, pos + len(t)
            pos = stop
            if stop <= i or start >= end:
                continue
            a, b = max(i, start) - start, min(end, stop) - start
            r.text = t[:a] + (value if first else "") + t[b:]
            first = False
        count += 1
        offset = i + len(value)


def replace_text(doc, mapping: dict[str, str]) -> dict[str, int]:
    counts = {k: 0 for k in mapping}
    for p in iter_paragraphs(doc):
        for key, value in mapping.items():
            if key in p.text:
                counts[key] += replace_in_runs(p.runs, key, str(value))
                for link in p.hyperlinks:
                    counts[key] += replace_in_runs(link.runs, key, str(value))
    return counts


def add_comments(doc, find: str, text: str, author: str) -> int:
    initials = "".join(w[0] for w in author.split()[:2]).upper() or None
    count = 0
    for p in list(iter_paragraphs(doc)):
        if find in p.text and p.runs:
            doc.add_comment(p.runs, text=text, author=author, initials=initials)
            count += 1
    return count


def main(argv: list[str]) -> int:
    if len(argv) < 3 or argv[0] not in ("replace", "comment"):
        print(__doc__.strip(), file=sys.stderr)
        return 1
    command, src, dst = argv[0], Path(argv[1]), Path(argv[2])
    if src.resolve() == dst.resolve():
        print("error: write to a new file; the input is never overwritten", file=sys.stderr)
        return 1
    opt = lambda name, default=None: argv[argv.index(name) + 1] if name in argv else default  # noqa: E731
    try:
        doc = Document(str(src))
        if command == "replace":
            with open(opt("--map"), encoding="utf-8") as f:
                counts = replace_text(doc, json.load(f))
            for k, n in counts.items():
                print(f"{n:>4}  {k}")
            matched = sum(counts.values())
        else:
            find, text = opt("--find"), opt("--text")
            if not find or not text:
                print("error: comment needs --find and --text", file=sys.stderr)
                return 1
            matched = add_comments(doc, find, text, opt("--author", "Reviewer"))
            print(f"{matched} comment(s) added")
        doc.save(str(dst))
        return 0 if matched else 10
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
