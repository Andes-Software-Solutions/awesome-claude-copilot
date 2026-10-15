"""Read, check, and transform PDFs.

    python -B pdf_tools.py info    <pdf>
    python -B pdf_tools.py text    <pdf> [--pages 1-3,5] [--layout]
    python -B pdf_tools.py tables  <pdf> [--pages ...] [--csv-dir DIR] [--text-columns]
    python -B pdf_tools.py fonts   <pdf>                          exit 10 if any font is not embedded
    python -B pdf_tools.py merge   <out> <in> <in> ...
    python -B pdf_tools.py split   <pdf> <out-dir> --ranges 1-3,4-6
    python -B pdf_tools.py rotate  <pdf> <out> --degrees 90 [--pages ...]
    python -B pdf_tools.py stamp   <pdf> <out> (--text DRAFT | --pdf overlay.pdf) [--pages ...]
    python -B pdf_tools.py fields  <pdf>
    python -B pdf_tools.py fill    <pdf> <out> --data values.json
    python -B pdf_tools.py encrypt <pdf> <out> --password-env VAR
    python -B pdf_tools.py decrypt <pdf> <out> --password-env VAR
    python -B pdf_tools.py render  <pdf> <out-dir> [--pages ...] [--dpi 80]

Passwords are read from the named environment variable, never from the command line.
Page numbers are 1-based. Exit codes: 0 done, 10 findings, 1 error.
"""
from __future__ import annotations

import csv
import io
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError


def parse_pages(spec: str | None, count: int) -> list[int]:
    """'1-3,5' -> [0, 1, 2, 4]; None -> every page."""
    if not spec:
        return list(range(count))
    pages: list[int] = []
    for part in spec.split(","):
        a, _, b = part.strip().partition("-")
        start, end = int(a), int(b) if b else int(a)
        if not 1 <= start <= end <= count:
            raise ValueError(f"page range {part} is outside 1-{count}")
        pages.extend(range(start - 1, end))
    return pages


def info(path: Path) -> dict:
    r = PdfReader(str(path))
    if r.is_encrypted and not r.decrypt(""):
        return {"encrypted": True, "note": "a password is needed to read it; use decrypt"}
    meta = {k.lstrip("/"): str(v) for k, v in (r.metadata or {}).items()}
    sizes = sorted({(round(float(p.mediabox.width) / 72, 2), round(float(p.mediabox.height) / 72, 2)) for p in r.pages})
    return {"pages": len(r.pages), "encrypted": r.is_encrypted, "metadata": meta, "pageSizesIn": sizes,
            "formFields": len(r.get_fields() or {}), "outline": len(r.outline)}


def fonts(path: Path) -> list[dict]:
    r = PdfReader(str(path))
    found: dict[str, dict] = {}
    for i, page in enumerate(r.pages, 1):
        resources = page.get("/Resources")
        font_dict = resources.get_object().get("/Font") if resources else None
        if not font_dict:
            continue
        for ref in font_dict.get_object().values():
            font = ref.get_object()
            name = str(font.get("/BaseFont", "?"))
            descriptor = font.get("/FontDescriptor")
            if descriptor is None and "/DescendantFonts" in font:
                descriptor = font["/DescendantFonts"][0].get_object().get("/FontDescriptor")
            descriptor = descriptor.get_object() if descriptor is not None else {}
            embedded = any(k in descriptor for k in ("/FontFile", "/FontFile2", "/FontFile3"))
            entry = found.setdefault(name, {"font": name, "subtype": str(font.get("/Subtype")), "embedded": embedded, "pages": []})
            entry["pages"].append(i)
    return list(found.values())


def extract_text(path: Path, pages: str | None, layout: bool) -> str:
    try:
        import pdfplumber
    except ImportError:
        r = PdfReader(str(path))
        return "\n".join(f"--- page {i + 1} ---\n{r.pages[i].extract_text() or ''}" for i in parse_pages(pages, len(r.pages)))
    with pdfplumber.open(str(path)) as pdf:
        idx = parse_pages(pages, len(pdf.pages))
        return "\n".join(f"--- page {i + 1} ---\n{pdf.pages[i].extract_text(layout=layout) or ''}" for i in idx)


def extract_tables(path: Path, pages: str | None, csv_dir: Path | None, text_columns: bool = False) -> int:
    """Ruled tables by default; text_columns finds columns from text alignment, for tables
    drawn with horizontal rules only (as Andes PDFs are)."""
    import pdfplumber  # tables need pdfplumber; pypdf has no table detection
    settings = {"vertical_strategy": "text", "horizontal_strategy": "lines"} if text_columns else {}
    n = 0
    with pdfplumber.open(str(path)) as pdf:
        for i in parse_pages(pages, len(pdf.pages)):
            for t in pdf.pages[i].extract_tables(settings):
                # Chart gridlines and decorative rules come back as tables of empty cells.
                if not any((c or "").strip() for row in t for c in row):
                    continue
                n += 1
                if csv_dir:
                    csv_dir.mkdir(parents=True, exist_ok=True)
                    with open(csv_dir / f"page{i + 1}-table{n}.csv", "w", newline="", encoding="utf-8") as f:
                        csv.writer(f).writerows(t)
                else:
                    print(f"--- page {i + 1}, table {n} ---")
                    for row in t:
                        print(" | ".join("" if c is None else str(c).replace("\n", " ") for c in row))
    return n


def text_stamp(text: str, width: float, height: float) -> PdfReader:
    """A one-page overlay with diagonal text in the brand's secondary color, 25% opaque."""
    from reportlab.pdfgen import canvas as rl_canvas
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import pdf_brand

    fonts_used = pdf_brand.register_fonts()
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(width, height))
    c.setFillColor(pdf_brand.color("secondary"), alpha=0.25)
    size = min(width, height) / max(4, len(text) * 0.6)
    c.setFont(fonts_used["heading"], size)
    c.translate(width / 2, height / 2)
    c.rotate(45)
    c.drawCentredString(0, -size / 3, text)
    c.save()
    buf.seek(0)
    return PdfReader(buf)


def password(argv: list[str]) -> str:
    var = opt(argv, "--password-env")
    if not var or not os.environ.get(var):
        raise ValueError("set the password in an environment variable and pass its name with --password-env")
    return os.environ[var]


def render(path: Path, out_dir: Path, pages: str | None, dpi: int) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    count = len(PdfReader(str(path)).pages)
    idx = parse_pages(pages, count)
    if shutil.which("pdftoppm"):
        for i in idx:
            subprocess.run(["pdftoppm", "-png", "-r", str(dpi), "-f", str(i + 1), "-l", str(i + 1), "-singlefile",
                            str(path), str(out_dir / f"page-{i + 1}")], check=True)
    else:
        try:
            import pypdfium2 as pdfium
        except ImportError as e:
            raise ValueError("rendering needs poppler (pdftoppm on PATH) or the pypdfium2 package") from e
        pdf = pdfium.PdfDocument(str(path))
        for i in idx:
            pdf[i].render(scale=dpi / 72).to_pil().save(out_dir / f"page-{i + 1}.png")
    return [out_dir / f"page-{i + 1}.png" for i in idx]


def opt(argv: list[str], name: str, default: str | None = None) -> str | None:
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


def write(writer: PdfWriter, out: Path, sources: list[Path]) -> None:
    if any(out.resolve() == s.resolve() for s in sources):
        raise ValueError("write to a new file; inputs are never overwritten")
    with open(out, "wb") as f:
        writer.write(f)


def main(argv: list[str]) -> int:
    commands = ("info", "text", "tables", "fonts", "merge", "split", "rotate", "stamp", "fields", "fill", "encrypt", "decrypt", "render")
    if len(argv) < 2 or argv[0] not in commands:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    cmd, src = argv[0], Path(argv[1])
    try:
        if cmd == "info":
            print(json.dumps(info(src), indent=2))
        elif cmd == "text":
            print(extract_text(src, opt(argv, "--pages"), "--layout" in argv))
        elif cmd == "tables":
            csv_dir = opt(argv, "--csv-dir")
            n = extract_tables(src, opt(argv, "--pages"), Path(csv_dir) if csv_dir else None, "--text-columns" in argv)
            print(f"{n} table(s)")
            return 0 if n else 10
        elif cmd == "fonts":
            found = fonts(src)
            for f in found:
                print(f"{'embedded' if f['embedded'] else 'NOT EMBEDDED':>12}  {f['font']}  ({f['subtype']}; pages {f['pages'][0]}-{f['pages'][-1]})")
            return 10 if any(not f["embedded"] for f in found) else 0
        elif cmd == "merge":
            out, inputs = src, [Path(p) for p in argv[2:] if not p.startswith("--")]
            writer = PdfWriter()
            for p in inputs:
                writer.append(str(p))
            write(writer, out, inputs)
        elif cmd == "split":
            out_dir = Path(argv[2])
            out_dir.mkdir(parents=True, exist_ok=True)
            r = PdfReader(str(src))
            for spec in (opt(argv, "--ranges") or "").split(","):
                writer = PdfWriter()
                for i in parse_pages(spec, len(r.pages)):
                    writer.add_page(r.pages[i])
                write(writer, out_dir / f"{src.stem}-{spec.strip()}.pdf", [src])
        elif cmd in ("rotate", "stamp"):
            out = Path(argv[2])
            writer = PdfWriter(clone_from=str(src))
            idx = parse_pages(opt(argv, "--pages"), len(writer.pages))
            for i in idx:
                page = writer.pages[i]
                if cmd == "rotate":
                    page.rotate(int(opt(argv, "--degrees", "90")))
                else:
                    overlay = (PdfReader(opt(argv, "--pdf")) if opt(argv, "--pdf")
                               else text_stamp(opt(argv, "--text", "DRAFT"), float(page.mediabox.width), float(page.mediabox.height)))
                    page.merge_page(overlay.pages[0])
            write(writer, out, [src])
        elif cmd == "fields":
            fields = PdfReader(str(src)).get_fields() or {}
            print(json.dumps({name: {"type": str(f.get("/FT")), "value": str(f.get("/V")) if f.get("/V") is not None else None,
                                     "options": [str(o) for o in f.get("/_States_", [])]} for name, f in fields.items()}, indent=2))
            return 0 if fields else 10
        elif cmd == "fill":
            out = Path(argv[2])
            with open(opt(argv, "--data"), encoding="utf-8") as f:
                values = json.load(f)
            writer = PdfWriter(clone_from=str(src))
            known = set(writer.get_fields() or {}) if hasattr(writer, "get_fields") else set(PdfReader(str(src)).get_fields() or {})
            unknown = [k for k in values if k not in known]
            if unknown:
                print(f"warning: no field named {', '.join(unknown)}", file=sys.stderr)
            for page in writer.pages:
                writer.update_page_form_field_values(page, values, auto_regenerate=False)
            writer.set_need_appearances_writer(True)
            write(writer, out, [src])
            return 10 if unknown else 0
        elif cmd == "encrypt":
            out = Path(argv[2])
            writer = PdfWriter(clone_from=str(src))
            writer.encrypt(user_password=password(argv), algorithm="AES-256")
            write(writer, out, [src])
        elif cmd == "decrypt":
            out = Path(argv[2])
            reader = PdfReader(str(src))
            if reader.is_encrypted and not reader.decrypt(password(argv)):
                raise ValueError("wrong password")
            writer = PdfWriter(clone_from=reader)
            write(writer, out, [src])
        elif cmd == "render":
            for p in render(src, Path(argv[2]), opt(argv, "--pages"), int(opt(argv, "--dpi", "80"))):
                print(p)
        return 0
    except (OSError, ValueError, KeyError, PyPdfError, subprocess.CalledProcessError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
