"""Render an Office file to one PNG per slide or page, so every one can be looked at before handover.

    python -B office_render.py <file.pptx|.docx|.xlsx> <out-dir> [--dpi 96]

Identical copies live in andes-docx, andes-xlsx, and andes-pptx; the repository audit fails when they differ.
LibreOffice (soffice) converts the file to PDF (recalculating workbook formulas); pdftoppm (poppler) rasterizes it, or pypdfium2
with Pillow when poppler is missing (run with the venv Python then). Standard library otherwise.
Prints one PNG path per line. Exit codes: 0 rendered, 2 a renderer is missing, 1 error.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# soffice is rarely on PATH on Windows and macOS; these are the installers' default locations.
SOFFICE_PATHS = [
    Path("C:/Program Files/LibreOffice/program/soffice.exe"),
    Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
    Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
]
INSTALL_HINT = ("Install LibreOffice (winget install TheDocumentFoundation.LibreOffice, "
                "brew install --cask libreoffice, or sudo apt install libreoffice-impress)")


class MissingRenderer(Exception):
    pass


def find_soffice() -> str:
    found = shutil.which("soffice") or shutil.which("soffice.com")
    if found:
        return found
    for p in SOFFICE_PATHS:
        if p.exists():
            return str(p)
    raise MissingRenderer(f"soffice (LibreOffice) was not found. {INSTALL_HINT}.")


def to_pdf(src: Path, work: Path) -> Path:
    # A private profile, so a LibreOffice window the user has open does not swallow the conversion. It
    # lives in the short system temp folder: LibreOffice crashes when its profile path nears MAX_PATH.
    profile = (work / "lo-profile").resolve().as_uri()
    subprocess.run([find_soffice(), f"-env:UserInstallation={profile}", "--headless", "--convert-to", "pdf",
                    "--outdir", str(work), str(src.resolve())], check=True, capture_output=True, timeout=300)
    pdf = work / f"{src.stem}.pdf"
    if not pdf.exists():
        raise RuntimeError(f"LibreOffice did not produce {pdf.name}")
    return pdf


def rasterize(pdf: Path, out: Path, dpi: int) -> list[Path]:
    for old in out.glob("page-*.png"):
        old.unlink()
    if shutil.which("pdftoppm"):
        subprocess.run(["pdftoppm", "-png", "-r", str(dpi), str(pdf), str(out / "page")], check=True, capture_output=True, timeout=300)
        return sorted(out.glob("page-*.png"))
    try:
        import pypdfium2 as pdfium
    except ImportError as e:
        raise MissingRenderer("rasterizing needs poppler (pdftoppm on PATH) or the pypdfium2 and Pillow packages") from e
    doc = pdfium.PdfDocument(str(pdf))
    width = len(str(len(doc)))
    paths = []
    for i in range(len(doc)):
        path = out / f"page-{i + 1:0{width}d}.png"
        doc[i].render(scale=dpi / 72).to_pil().save(path)
        paths.append(path)
    return paths


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    src, out = Path(argv[0]), Path(argv[1])
    dpi = int(argv[argv.index("--dpi") + 1]) if "--dpi" in argv else 96
    try:
        if not src.is_file():
            raise FileNotFoundError(f"{src} does not exist")
        out.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="andes-render-") as tmp:
            pngs = rasterize(to_pdf(src, Path(tmp)), out, dpi)
    except MissingRenderer as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except (OSError, RuntimeError, subprocess.SubprocessError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    for p in pngs:
        print(p)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
