"""Resolve where Andes documents and their tooling live in the current repository.

    python -B workspace.py <docx|xlsx|pptx|pdf> [--title "Q3 report"] [--root PATH]

Prints JSON:
  out          docs/generated/<format>/<yyyy-mm-dd>-<slug>.<ext> (numbered when it already exists)
  outDir       docs/generated/<format>/
  work         docs/generated/.work/ for build scripts, the virtual environment, and node_modules
  venvPython   the virtual environment's interpreter, and venvExists whether it is there yet
  ignoreAdded  true when docs/generated/ was just added to .gitignore (tell the user)
  tracked      files under docs/generated/ that git already tracks (ignoring does not untrack them)

Standard library only, so it runs before anything is installed. Identical copies live in every
andes-documents skill; the repository audit fails when they differ.
Exit codes: 0 done, 1 error.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

FORMATS = ("docx", "xlsx", "pptx", "pdf")
GENERATED = Path("docs") / "generated"
IGNORE_LINE = "docs/generated/"


def _git(root: Path, *args: str) -> subprocess.CompletedProcess | None:
    try:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False)
    except OSError:
        return None


def repo_root(start: Path) -> Path:
    """The git top level, or the start folder when it is not inside a repository."""
    r = _git(start, "rev-parse", "--show-toplevel")
    return Path(r.stdout.strip()) if r and r.returncode == 0 and r.stdout.strip() else start


def slugify(title: str, limit: int = 60) -> str:
    ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")
    return slug[:limit].rstrip("-") or "document"


def ensure_ignored(root: Path) -> bool:
    """Add docs/generated/ to the root .gitignore unless git already ignores it. Returns True if added."""
    probe = _git(root, "check-ignore", "-q", f"{IGNORE_LINE}probe")
    if probe is None or probe.returncode == 0:
        return False
    if _git(root, "rev-parse", "--git-dir").returncode != 0:
        return False  # not a repository: nothing can be tracked
    gitignore = root / ".gitignore"
    text = gitignore.read_bytes().decode("utf-8") if gitignore.exists() else ""
    eol = "\r\n" if "\r\n" in text else "\n"
    with open(gitignore, "a", encoding="utf-8", newline="") as f:
        f.write(("" if not text or text.endswith("\n") else eol) + IGNORE_LINE + eol)
    return True


def tracked(root: Path) -> list[str]:
    r = _git(root, "ls-files", "--", IGNORE_LINE)
    return r.stdout.split() if r and r.returncode == 0 else []


def prepare(fmt: str, title: str | None = None, root: Path | None = None, today: dt.date | None = None) -> dict:
    if fmt not in FORMATS:
        raise ValueError(f"unknown format '{fmt}'; use {', '.join(FORMATS)}")
    root = repo_root(root or Path.cwd())
    out_dir = root / GENERATED / fmt
    work = root / GENERATED / ".work"
    out_dir.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    stem = f"{(today or dt.date.today()).isoformat()}-{slugify(title or 'document')}"
    out, n = out_dir / f"{stem}.{fmt}", 2
    while out.exists():
        out, n = out_dir / f"{stem}-{n}.{fmt}", n + 1
    venv = work / ".venv"
    venv_python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return {
        "root": str(root),
        "out": str(out),
        "outDir": str(out_dir),
        "work": str(work),
        "venvPython": str(venv_python),
        "venvExists": venv_python.exists(),
        "nodeModules": (work / "node_modules").is_dir(),
        "ignoreAdded": ensure_ignored(root),
        "tracked": tracked(root),
    }


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in FORMATS:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    opt = lambda name: argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else None  # noqa: E731
    try:
        result = prepare(argv[0], opt("--title"), Path(opt("--root")) if opt("--root") else None)
    except (OSError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
