"""Package-level checks and branding for Office Open XML files (.docx, .xlsx, .pptx).

Standard library only, so it runs before any package is installed. Identical copies live in
andes-docx, andes-xlsx, and andes-pptx; the repository audit fails when they differ.

    python -B office_pkg.py check  <file>            structure: zip, XML, relationships, content types
    python -B office_pkg.py theme  <file> [-o out]   Andes color and font scheme in every theme part, plus generator cleanup
    python -B office_pkg.py colors <file>            every explicit RGB color, off-palette ones flagged, and theme parts not on the Andes scheme
    python -B office_pkg.py text   <file>            plain text, in reading order

Exit codes: 0 clean, 10 findings, 1 error.
"""
from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Iterator
from xml.etree import ElementTree as ET

BRAND_PATH = Path(__file__).resolve().parent.parent / "assets" / "brand.json"

# Limits for untrusted archives: a crafted file can expand to many gigabytes.
MAX_TOTAL_BYTES = 1 << 30
MAX_RATIO = 1000

# CT_ColorScheme requires this element order (ECMA-376 Part 1, 20.1.6.2).
THEME_SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4",
               "accent5", "accent6", "hlink", "folHlink"]

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}

# Colors applied to content. SpreadsheetML's legacy indexedColors table (rgbColor) is a palette
# definition, not a use, so it is not matched.
COLOR_PATTERNS = [
    re.compile(r'srgbClr\s+val="([0-9A-Fa-f]{6})"'),
    re.compile(r'<w:color\s+w:val="([0-9A-Fa-f]{6})"'),
    re.compile(r'\bw:color="([0-9A-Fa-f]{6})"'),
    re.compile(r'w:fill="([0-9A-Fa-f]{6})"'),
    re.compile(r'<(?:\w+:)?(?:color|fgColor|bgColor)\b[^>]*?\brgb="(?:[0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})"'),
]


class PackageError(Exception):
    pass


def load_brand(path: Path | None = None) -> dict:
    with open(path or BRAND_PATH, encoding="utf-8") as f:
        return json.load(f)


def palette(brand: dict) -> dict[str, str]:
    """Uppercase hex without '#' -> role name."""
    return {c["hex"].lstrip("#").upper(): role for role, c in brand["colors"].items()}


def open_package(path: Path) -> zipfile.ZipFile:
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile as e:
        raise PackageError(f"{path} is not a zip package ({e})") from e
    total = 0
    for info in z.infolist():
        total += info.file_size
        if info.compress_size and info.file_size > 10_000_000 and info.file_size / info.compress_size > MAX_RATIO:
            raise PackageError(f"{info.filename} expands {info.file_size // info.compress_size}x; refusing to open")
    if total > MAX_TOTAL_BYTES:
        raise PackageError(f"package expands to {total:,} bytes; refusing to open")
    return z


def parse_part(z: zipfile.ZipFile, name: str) -> ET.Element:
    data = z.read(name)
    # OOXML parts never carry a DTD; refusing one rules out entity-expansion attacks.
    if b"<!DOCTYPE" in data[:4096]:
        raise PackageError(f"{name} declares a DTD")
    return ET.fromstring(data)


def check(path: Path) -> list[str]:
    findings: list[str] = []
    z = open_package(path)
    with z:
        bad = z.testzip()
        if bad:
            findings.append(f"CRC mismatch in {bad}")
        names = set(z.namelist())
        if "[Content_Types].xml" not in names:
            return findings + ["[Content_Types].xml is missing"]
        roots: dict[str, ET.Element] = {}
        for name in sorted(names):
            if name.endswith((".xml", ".rels")):
                try:
                    roots[name] = parse_part(z, name)
                except (ET.ParseError, PackageError) as e:
                    findings.append(f"{name} does not parse: {e}")

        types = roots.get("[Content_Types].xml")
        if types is not None:
            defaults = {d.get("Extension", "").lower() for d in types.findall("ct:Default", NS)}
            overrides = {o.get("PartName", "") for o in types.findall("ct:Override", NS)}
            for name in names:
                if name.endswith("/") or name == "[Content_Types].xml":
                    continue
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if f"/{name}" not in overrides and ext not in defaults:
                    findings.append(f"{name} has no content type")
            for part in overrides:
                if part.lstrip("/") not in names:
                    findings.append(f"[Content_Types].xml lists {part}, which is not in the package")

        for name, root in roots.items():
            if not name.endswith(".rels"):
                continue
            source_dir = posixpath.dirname(posixpath.dirname(name))
            for r in root.findall("rel:Relationship", NS):
                if r.get("TargetMode") == "External":
                    continue
                target = r.get("Target", "")
                resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(source_dir, target))
                if resolved not in names:
                    findings.append(f"{name}: relationship {r.get('Id')} points at missing part {resolved}")
    return findings


def _theme_parts(names: list[str]) -> list[str]:
    return [n for n in names if re.fullmatch(r"(word|xl|ppt)/theme/theme\d+\.xml", n)]


def _color_scheme(prefix: str, brand: dict) -> str:
    slots = "".join(
        f'<{prefix}{slot}><{prefix}srgbClr val="{brand["colors"][brand["theme"][slot]]["hex"].lstrip("#").upper()}"/></{prefix}{slot}>'
        for slot in THEME_SLOTS
    )
    return f'<{prefix}clrScheme name="{brand["name"]}">{slots}</{prefix}clrScheme>'


def _set_typeface(xml: str, prefix: str, element: str, typeface: str) -> str:
    block = re.compile(rf"(<{prefix}{element}>.*?</{prefix}{element}>)", re.S)

    def replace(m: re.Match) -> str:
        return re.sub(rf'(<{prefix}latin\s+typeface=")[^"]*(")', rf"\g<1>{typeface}\g<2>", m.group(1), count=1)

    return block.sub(replace, xml, count=1)


# Colors that generators hard-code in chart parts and that later settings override (PptxGenJS
# writes a near-white pie outline and black label text, then per-point values). Mapping them to
# brand roles keeps the colors report clean without changing what renders.
CHART_DEFAULTS = {"000000": "body", "F9F9F9": "page"}


def apply_theme(path: Path, brand: dict, out: Path | None = None) -> list[str]:
    """Brand a finished package; run it once after the generator writes the file.

    - Rewrites the color scheme and the Latin heading/body fonts of every theme part.
    - Drops [Content_Types].xml overrides for parts that do not exist (PptxGenJS lists one slide
      master per slide).
    - Maps the generator defaults in CHART_DEFAULTS to brand colors in chart parts.

    Other parts are copied byte for byte. Returns the parts that changed.
    """
    out = out or path
    fonts = brand["fonts"]["office"]
    changed: list[str] = []
    with open_package(path) as z:
        entries = [(info, z.read(info.filename)) for info in z.infolist()]
    names = [info.filename for info, _ in entries]
    present = {f"/{n}" for n in names}
    themes = set(_theme_parts(names))
    chart_colors = {k: brand["colors"][role]["hex"].lstrip("#").upper() for k, role in CHART_DEFAULTS.items()}
    rewritten = []
    for info, data in entries:
        if info.filename == "[Content_Types].xml":
            xml = data.decode("utf-8")
            stale = [m for m in re.findall(r'<Override\b[^>]*?PartName="([^"]+)"[^>]*/>', xml) if m not in present]
            if stale:
                xml = re.sub(r'<Override\b[^>]*?PartName="([^"]+)"[^>]*/>', lambda m: "" if m.group(1) in stale else m.group(0), xml)
                data = xml.encode("utf-8")
                changed.append(info.filename)
        elif re.fullmatch(r"(word|xl|ppt)/charts/chart\d+\.xml", info.filename):
            xml = data.decode("utf-8")
            new = re.sub(r'(srgbClr\s+val=")([0-9A-Fa-f]{6})(")',
                         lambda m: m.group(1) + chart_colors.get(m.group(2).upper(), m.group(2)) + m.group(3), xml)
            if new != xml:
                data = new.encode("utf-8")
                changed.append(info.filename)
        elif info.filename in themes:
            xml = data.decode("utf-8")
            m = re.search(r"<(\w+:)?clrScheme\b", xml)
            if not m:
                raise PackageError(f"{info.filename} has no color scheme")
            prefix = m.group(1) or ""
            xml = re.sub(rf"<{prefix}clrScheme\b.*?</{prefix}clrScheme>", _color_scheme(prefix, brand), xml, count=1, flags=re.S)
            xml = re.sub(rf'(<{prefix}fontScheme\s+name=")[^"]*(")', rf'\g<1>{brand["name"]}\g<2>', xml, count=1)
            xml = _set_typeface(xml, prefix, "majorFont", fonts["heading"])
            xml = _set_typeface(xml, prefix, "minorFont", fonts["body"])
            ET.fromstring(xml.encode("utf-8"))
            data = xml.encode("utf-8")
            changed.append(info.filename)
        rewritten.append((info, data))
    tmp = out.with_name(out.name + ".tmp")
    with zipfile.ZipFile(tmp, "w") as z:
        for info, data in rewritten:
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED)
    tmp.replace(out)
    return changed


def colors(path: Path, brand: dict) -> dict[str, int]:
    """Count every explicit RGB value in the package's content parts, keyed by uppercase hex.

    Theme parts are skipped: apply_theme owns their color scheme, and the rest of a theme holds
    effect defaults (shadows) that no content uses unless it references them.
    """
    counts: Counter[str] = Counter()
    with open_package(path) as z:
        themes = set(_theme_parts(z.namelist()))
        for name in z.namelist():
            if not name.endswith(".xml") or name in themes:
                continue
            xml = z.read(name).decode("utf-8", errors="replace")
            for pattern in COLOR_PATTERNS:
                counts.update(v.upper() for v in pattern.findall(xml))
    return dict(counts)


def theme_findings(path: Path, brand: dict) -> list[str]:
    """Theme parts whose color scheme is not the brand's, which means `theme` was skipped."""
    want = {slot: brand["colors"][brand["theme"][slot]]["hex"].lstrip("#").upper() for slot in THEME_SLOTS}
    findings = []
    with open_package(path) as z:
        for name in _theme_parts(z.namelist()):
            xml = z.read(name).decode("utf-8", errors="replace")
            m = re.search(r"<(\w+:|)clrScheme\b.*?</\1clrScheme>", xml, re.S)
            scheme, prefix = (m.group(0), m.group(1)) if m else ("", "")
            wrong = [slot for slot, hex_ in want.items()
                     if not re.search(rf'<{prefix}{slot}>\s*<{prefix}srgbClr\s+val="{hex_}"', scheme, re.I)]
            if wrong:
                findings.append(f"THEME {name}: not the {brand['name']} color scheme ({', '.join(wrong)}); run office_pkg.py theme")
    return findings


def _paragraph_text(p: ET.Element, ns: str) -> str:
    parts = []
    for el in p.iter():
        tag = el.tag.split("}")[-1]
        if tag == "t" and el.text:
            parts.append(el.text)
        elif tag == "tab" and ns == "w":
            parts.append("\t")
        elif tag in ("br", "cr"):
            parts.append("\n")
    return "".join(parts)


def text(path: Path) -> Iterator[str]:
    with open_package(path) as z:
        names = z.namelist()
        if "word/document.xml" in names:
            body = parse_part(z, "word/document.xml")
            for p in body.iter(f"{{{NS['w']}}}p"):
                yield _paragraph_text(p, "w")
        elif "ppt/presentation.xml" in names:
            slides = sorted((n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                            key=lambda n: int(re.search(r"(\d+)\.xml$", n).group(1)))
            for i, name in enumerate(slides, 1):
                yield f"--- slide {i} ---"
                for p in parse_part(z, name).iter(f"{{{NS['a']}}}p"):
                    line = _paragraph_text(p, "a")
                    if line.strip():
                        yield line
        elif "xl/workbook.xml" in names:
            if "xl/sharedStrings.xml" in names:
                for si in parse_part(z, "xl/sharedStrings.xml").findall("s:si", NS):
                    yield "".join(t.text or "" for t in si.iter(f"{{{NS['s']}}}t"))
            for name in sorted(n for n in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)):
                for t in parse_part(z, name).iter(f"{{{NS['s']}}}t"):
                    if t.text:
                        yield t.text
        else:
            raise PackageError(f"{path} is not a Word, Excel, or PowerPoint package")


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[0] not in ("check", "theme", "colors", "text"):
        print(__doc__.strip(), file=sys.stderr)
        return 1
    command, path = argv[0], Path(argv[1])
    out = Path(argv[argv.index("-o") + 1]) if "-o" in argv else None
    try:
        if command == "check":
            findings = check(path)
            for f in findings:
                print(f)
            print(f"{len(findings)} finding(s)" if findings else "Package is well formed.")
            return 10 if findings else 0
        brand = load_brand()
        if command == "theme":
            changed = apply_theme(path, brand, out)
            print("\n".join(f"updated {n}" for n in changed) if changed else "Nothing to change.")
            return 0
        if command == "colors":
            known = palette(brand)
            counts = colors(path, brand)
            off = 0
            for hex_, n in sorted(counts.items(), key=lambda kv: -kv[1]):
                role = known.get(hex_)
                off += role is None
                print(f"#{hex_}  {n:>5}  {role or 'OFF-PALETTE'}")
            themes = theme_findings(path, brand)
            for f in themes:
                print(f)
            return 10 if off or themes else 0
        for line in text(path):
            print(line)
        return 0
    except (PackageError, OSError, KeyError, ET.ParseError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
