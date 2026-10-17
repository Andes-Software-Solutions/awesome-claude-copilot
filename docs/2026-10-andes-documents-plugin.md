# Document plugin: `andes-documents`

**Date:** 2026-10-14. **Status:** accepted. Extends [2026-09-harness-trees.md](2026-09-harness-trees.md) (both trees, mirrored shared files) and [2026-09-plugin-architecture.md](2026-09-plugin-architecture.md) (plugins are opt-in; `andes-core` stays small).

Amended by [2026-10-andes-documents-copilot-only.md](2026-10-andes-documents-copilot-only.md).

## Why

Claude Code ships built-in `docx`, `xlsx`, `pptx`, and `pdf` skills. Copilot has no equivalent, and neither harness styles output in the Andes palette. The request: give Copilot the same document-creation abilities, in Andes colors.

The built-in skills cannot be copied. Their `LICENSE.txt` forbids reproduction, derivative works, and distribution, and this repository is public and MIT. A third-party copy that claims MIT (`appautomaton/document-skills`) says it is "adapted from Anthropic skills", so it is no safer. The skills here are therefore original work (see Provenance).

## What shipped

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-documents` | 1.14.0 | Four skills in both trees: `andes-docx`, `andes-xlsx`, `andes-pptx`, `andes-pdf`. Depends on `andes-core` |
| `andes-core` | 1.14.0 | `andes-init` lists `andes-documents` as optional (no file signal). Step 4 also offers a `docs/generated/` line in `.gitignore` when the plugin is installed, and its report says whether the folder is ignored |
| Repository | 1.14.0 | Three audit rules, `.gitattributes`, `.gitignore` entries, binary-safe `sync-shared.mjs`; README sections |

| Skill | Create | Edit and read |
| --- | --- | --- |
| `andes-docx` | `docx` (npm, v9) | python-docx ≥ 1.2 |
| `andes-xlsx` | openpyxl ≥ 3.1 | openpyxl |
| `andes-pptx` | PptxGenJS v4 | python-pptx ≥ 1.0 |
| `andes-pdf` | ReportLab 5 | pypdf 6 (merge, split, rotate, stamp, forms, AES-256 encryption), pdfplumber (text and tables), optional pypdfium2 or poppler for page images |

Each skill carries `assets/brand.json`, `scripts/workspace.py` (stdlib only, identical in all four), a `SKILL.md` with a Prerequisites section, `references/`, and helper scripts. The docx, xlsx, and pptx skills share `scripts/office_pkg.py`, a stdlib-only tool with four commands:

| Command | Does |
| --- | --- |
| `check` | Validates the zip, XML, relationships, and content types |
| `theme` | Writes the Andes color and font scheme into every theme part; drops stale `[Content_Types]` overrides (PptxGenJS lists a slide master per slide); maps two PptxGenJS chart defaults (`F9F9F9` pie outlines, black label text) to brand colors where per-point settings override them |
| `colors` | Flags off-palette colors in content parts |
| `text` | Extracts text |

The inspect and edit helpers (`docx_inspect`, `docx_edit`, `xlsx_inspect`, `pptx_inspect`, `pptx_edit`, `pdf_tools`) flag accessibility problems: skipped heading levels, missing slide titles, images and charts without alt text, text under 12 pt on slides, and non-embedded PDF fonts.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Opt-in plugin, shipped in both trees; not in `andes-core` | Consumers who never make documents pay no always-on tokens. Measured cost: about 580 tokens (Claude Code 2.1.296 `plugin details`). The existing mirror rules apply. `andes-init` lists it as optional because no file signal implies it. |
| D2 | Original work with a recorded Provenance | The built-in skills' license forbids derivatives, and the third-party "MIT" copy derives from them. No Anthropic text, script, or palette was consulted. |
| D3 | One stack per format | `docx` and PptxGenJS (Node) create new files only; python-docx and python-pptx open and edit existing ones; openpyxl does both for workbooks; ReportLab creates PDFs and pypdf operates on existing ones. Node is needed only for `.docx` and `.pptx` creation. |
| D4 | `brand.json` copies, one per skill, plus the audit rules below | A skill's scripts read only their own folder, so each skill holds a copy. The audit keeps the copies identical and checks the contrast pairs. Code reads colors by role, never by hex. |
| D5 | Role-keyed palette, sampled from the Andes logo | Primary Summit Navy `#14324f`, emphasis Ink `#0b1f33`, body `#16283a`, secondary Slate `#5a6e82`, accent Glacier Blue `#21a8d8`, accentStrong `#0e7fa8`, success Andes Green `#2e9c58`, successFill (logo green) `#3fb56a`, warning `#9c6210`, danger `#c0392b`, page `#ffffff`, surface Snow `#f7fafc`, surfaceAlt `#e7eff7`, surfaceSubtle `#eff4f9`, border `#dce5ee`. Glacier Blue is 2.74:1 on white, so it is decoration only there; `accentStrong` carries text and series. Chart series order is navy, green, `#0e7fa8`, amber, slate, with a maximum of five. The Office theme slots follow ECMA-376 order (`dk1`, `lt1`, `dk2`, `lt2`, `accent1`-`6`, `hlink`, `folHlink`). |
| D6 | Office files use Arial headings and Calibri body; PDFs embed Montserrat Bold and Inter | Recipients already have the Office fonts, so layout holds without embedding. PDFs have no such guarantee. |
| D7 | Bundle the OFL fonts in `andes-pdf/assets/fonts` | Downloads fail offline, behind proxies, and inside the cloud agent's firewall. Static TTFs, unmodified: Inter 4.001 Regular, Bold, Italic (rsms/inter v4.1 `extras/ttf`) and Montserrat 9.000 Bold (JulietaUla/Montserrat `fonts/ttf`). `OFL-Inter.txt`, `OFL-Montserrat.txt`, and `FONTS.md` (SHA-256s) sit beside them. About 1.7 MB per tree. |
| D8 | No line in the always-on `AGENTS.md` block | The block is at 699 of its 700-word budget. Description-based routing works: a headless Claude Code check chose `andes-documents:andes-pdf` and `andes-documents:andes-xlsx` for Andes-branded requests even with Claude's built-in document skills present. |
| D9 | Runtime prerequisites are stated and never installed silently | Every `SKILL.md` has a Prerequisites section. Python 3.9+ is required for all four skills. Node.js 18+ is required only to create `.docx` and `.pptx`. If a runtime is missing, the skill stops and prints the platform install command (winget, brew, apt). Packages install only after the user approves, into the repository's `docs/generated/.work/` folder (D14), never globally. |
| D10 | Portable helpers | Helpers run with `python -B`, so no bytecode lands in the installed plugin. Helpers that need packages run with the workspace's `venvPython`; `workspace.py` and `office_pkg.py` need only the standard library. Node helpers import only `node:` built-ins and receive the library from the build script, because ESM ignores `NODE_PATH`. No Claude-only tools, no hard-coded `/tmp`, no `AF_UNIX`. |
| D11 | QA works without LibreOffice | Structure (`check`), colors, outline, and accessibility flags need no renderer. LibreOffice and poppler are optional, for page images. |
| D12 | `sync-shared.mjs` compares binary files byte for byte | A file with a NUL byte in its first 8,000 bytes is binary. UTF-8 decoding maps invalid bytes to U+FFFD, so two different fonts could compare equal. The sync also skips `__pycache__` and `node_modules`. `.gitattributes` marks `*.ttf` binary; `.gitignore` adds `__pycache__/` and `*.pyc`. |
| D13 | `textExt` includes `.py` | `harness-paths` now scans the Python helpers for harness-specific paths. |
| D14 | Everything is written under `docs/generated/` at the repository root, which is git-ignored | The user wanted one predictable location in the repo that is never committed. Every `SKILL.md` starts with `<python> -B <skill>/scripts/workspace.py <docx\|xlsx\|pptx\|pdf> --title "<title>"`, which prints JSON. `out` is `docs/generated/<format>/<yyyy-mm-dd>-<slug>.<ext>` (git top level, or the current folder outside a repo), numbered `-2`, `-3` instead of overwriting. `work` is `docs/generated/.work/`, which holds build scripts (`build-<slug>.py\|mjs`), `.venv`, and `node_modules`; the JSON also gives `venvPython`, `venvExists`, and `nodeModules`. The persistent `.work/` means packages are approved and installed once per repository, not per task as with a fresh temp folder. Date-prefixed names match the `docs/plans/<yyyy-mm-dd>-<slug>.md` convention. One ignore line covers outputs and tooling. `workspace.py` appends `docs/generated/` to the root `.gitignore` when git does not already ignore it (matching the file's line endings) and reports it as `ignoreAdded`; it lists files git already tracks there as `tracked`. The skill tells the user about both and never untracks anything. A path the user names always wins. Rejected: tooling in a hidden root folder `.andes/documents/` (two ignore lines) and the OS temp folder (reinstall per task). |

## Audit rules

| Rule | Severity | Fails when |
| --- | --- | --- |
| `skills/shared-missing` | error | A file listed in `CONFIG.sharedSkillFiles` (`brand.json`, `office_pkg.py`, `workspace.py`) is absent from one of the skills that must carry it |
| `skills/shared-drift` | error | The copies of a file listed in `CONFIG.sharedSkillFiles` differ |
| `skills/brand-contrast` | error | A declared contrast pair is below its WCAG 2.2 minimum (text 4.5:1 from SC 1.4.3, large text 3:1, graphics 3:1 from SC 1.4.11), the pair names a color with no hex, or the file is not valid JSON |

Both trees are also covered by the existing `mirror/*` and `isolation/*` rules. Verified: the three rules fire on a deliberately broken `brand.json`, and the sync detects a one-byte change in a font.

## Deferred

Not in v1:

- **`andes-docx`.** Tracked changes, editing footnotes in existing files, native Word charts, `.doc`, PDF export without LibreOffice.
- **`andes-xlsx`.** Recalculation without Excel or LibreOffice, pivots, sparklines, shapes, macros, `.xls`.
- **`andes-pptx`.** Deleting, duplicating, or reordering slides, `.potx` templates, animations, SmartArt.
- **`andes-pdf`.** OCR, PDF/UA tagging (needs ReportLab's commercial add-on), PDF/A, signatures, true redaction, in-place text editing, HTML to PDF.
- **Brand assets.** The Andes logo (the source is `.webp`, and shipping a trademark needs approval) and dark variants.

## Not verified

- **Office rendering.** LibreOffice is not installed on the dev machine, so `.docx`, `.xlsx`, and `.pptx` layout was checked structurally only (`check`, `colors`, inspect).
- **Copilot CLI** loading and running the skills.
- **macOS and Linux.** Verified on Windows 11 with Python 3.12.6 and Node 24.
- **Image viewing for visual QA on Copilot CLI.**
- **LibreOffice recalculation** of openpyxl formulas on convert.

Verified in a scratch git repo: `workspace.py` added the ignore line once; an xlsx (openpyxl in `docs/generated/.work/.venv`) and a docx (`npm --prefix docs/generated/.work`) landed in `docs/generated/<format>/`; the second skill reused the same venv; a repeated title produced `-2`; a non-ASCII title slugged correctly; a non-repo folder fell back to the current folder; `git status` showed only `.gitignore`.

Verified locally: each skill built sample files that pass `check`, `colors`, and inspect; the PDFs embed only Inter and Montserrat and were rendered and viewed. `node scripts/repo-audit.mjs --strict --base=origin/main`, `claude plugin validate --strict` (marketplace and all 8 plugins), and `node scripts/tests/run.mjs` (19 tests) pass.

## Provenance

The four skills were written from public documentation. No Anthropic skill text, script, or palette was consulted.

| Source | Used for |
| --- | --- |
| `docx` ([dolanmiu/docx](https://github.com/dolanmiu/docx)) | Creating `.docx` |
| [python-docx](https://python-docx.readthedocs.io/) | Editing and reading `.docx` |
| [openpyxl](https://openpyxl.readthedocs.io/) | Creating, editing, and reading `.xlsx` |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | Creating `.pptx` |
| [python-pptx](https://python-pptx.readthedocs.io/) | Editing and reading `.pptx` |
| [ReportLab](https://docs.reportlab.com/) | Creating PDFs |
| [pypdf](https://pypdf.readthedocs.io/) and [pdfplumber](https://github.com/jsvine/pdfplumber) | PDF operations; text and table extraction |
| ECMA-376 Part 1, DrawingML theme | `clrScheme` slot order |
| WCAG 2.2 SC 1.4.3 and 1.4.11 | Contrast minimums |
| Andes UI design tokens (`enterprise-gpt-ui` `_tokens.scss`, light theme) and the Andes logo | Palette |

The `docx`, PptxGenJS, and ReportLab APIs were checked against their current documentation through Context7. Every helper was then run against the installed versions (docx 9.11, pptxgenjs 4.0.1, openpyxl 3.1.5, python-docx 1.2.0, python-pptx 1.0.2, ReportLab 5.0.1, pypdf 6.20, pdfplumber 0.11), which surfaced several library defaults the helpers now override: openpyxl 3.1 hiding chart axes, PptxGenJS copying every master placeholder onto each slide, and ReportLab's default Helvetica and Times-Roman, which are never embedded.

## References

- Claude Code built-in document skills license (why no copy): `LICENSE.txt` in each built-in skill
- appautomaton/document-skills: <https://github.com/appautomaton/document-skills>
- ECMA-376, Office Open XML: <https://ecma-international.org/publications-and-standards/standards/ecma-376/>
- WCAG 2.2, 1.4.3 Contrast (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- WCAG 2.2, 1.4.11 Non-text Contrast: <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- SIL Open Font License 1.1: <https://openfontlicense.org/>
- Inter: <https://github.com/rsms/inter>
- Montserrat: <https://github.com/JulietaUla/Montserrat>
