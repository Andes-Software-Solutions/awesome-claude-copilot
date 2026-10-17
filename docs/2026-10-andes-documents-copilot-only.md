# Document plugin on Copilot only, with a document designer agent and shared brand assets

**Date:** 2026-10-16. **Status:** accepted. Amends [2026-10-andes-documents-plugin.md](2026-10-andes-documents-plugin.md): decision D1, "opt-in plugin, shipped in both trees", is superseded. Everything else in that record (original work, one stack per format, palette, fonts, workspace layout) still holds. Builds on [2026-09-harness-trees.md](2026-09-harness-trees.md) and [2026-10-copilot-writer-haiku-5-5.md](2026-10-copilot-writer-haiku-5-5.md).

## Why

Claude Code ships built-in `docx`, `xlsx`, `pptx`, and `pdf` skills. The Claude copy of `andes-documents` duplicated them and competed with them for routing, so Claude users got two skills for the same request. The plugin existed to give Copilot those abilities in Andes colors. Copilot is the only harness that needs the builders, so `andes-documents` now ships there only.

Claude users still need Andes branding on what the built-in skills produce, and the logo had never been available in any format. The brand rules and logo files therefore moved to `andes-core`, which both harnesses install, in a small `andes-brand` skill.

Decks were also the weakest output, and the other formats had no logo or visual review at all. The masters carried no logo, titles rendered centered, images could stretch, and nothing looked at a rendered page. A model that cannot see its output, or has no rules for it, produces plain bullet lists. This change fixes that with the logo in every format, more deck builders, stricter checks, a render step, and a dedicated agent.

## What changed

| Plugin | Version | Change |
| --- | --- | --- |
| `andes-documents` | 1.15.0 | Copilot only. New `andes-document-designer` agent, logo in every format, redesigned deck masters, seven new slide builders, generalized renderer, stricter checks |
| `andes-core` | 1.15.0 | New `andes-brand` skill (logos, `brand.json`, brand rules) for both harnesses; description mentions the brand assets |
| All others | 1.15.0 | Version lockstep only |
| Repository | 1.15.0 | `COPILOT_ONLY` in `sync-shared.mjs`; `repo-audit.mjs` and `release.mjs` read `copilot/` for these plugins; audit `sharedSkillFiles` reworked; `.gitattributes` marks `*.png` binary |

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1a | Remove `claude/andes-documents/` and its Claude marketplace entry; the Claude marketplace description no longer mentions documents | Claude's built-in skills cover the same formats. Claude users who installed the plugin should run `/plugin uninstall andes-documents@andes`. |
| D15 | `COPILOT_ONLY = ['andes-documents']`, exported from `scripts/sync-shared.mjs`; edit these plugins in place under `copilot/` | Sync never mirrors or deletes them. Without this, a default sync would have deleted all the plugin's Copilot skill files once the Claude copy was gone. |
| D16 | The audit imports `COPILOT_ONLY` and adapts (see Audit changes) | One list drives both scripts, so a second Copilot-only plugin needs one edit. |
| D17 | `release.mjs` reads plugin versions from the `copilot/` manifests | Every plugin has a Copilot manifest, including the Copilot-only one. |
| D18 | One agent, `andes-document-designer`, Copilot only, model `[claude-haiku-5.5, Claude Haiku 5.5 (copilot)]`, `reasoning-effort: high`. It started as a deck-only agent (`andes-deck-designer`) and was widened to Word, Excel, PowerPoint, and PDF, so that name no longer exists | Haiku 5.5 keeps AI Credits cost low, the same reasoning as the writer agent. High effort is the user's explicit choice: design judgment and the visual review loop benefit from more reasoning. One agent with one process is cheaper to maintain than four, and the format-specific detail lives in the skills. It is listed in `copilotOnlyAgents` and pinned by `copilotEffort`. Tools: read, edit, search, execute, todo. |
| D19 | Derive the logo from the GitHub organization avatar; the repository owner decided | No SVG or vector artwork exists. See Logo. This resolves "Brand assets: logo deferred" in the earlier record. |
| D20 | Builders record brand issues and `writeDeck` refuses to write in strict mode | A rule the model can skip does not hold. A deck that breaks a rule never reaches disk. |
| D21 | Visual review is a standard QA step for every format; output checked only structurally must say so | Structural checks cannot see overlap, crowding, a missing logo, or an ugly page. |
| D22 | `office_pkg.py colors` exits 10 when a theme part is off the Andes color scheme | A skipped `office_pkg.py theme` step used to pass QA silently. |
| D23 | New `andes-brand` skill in `andes-core`, mirrored to `copilot/andes-core/` by sync, owns the logos and a copy of `assets/brand.json` | Claude Code has no `andes-documents`, but its built-in document skills still need the logo and palette. On Claude Code the skill guides those built-in skills; on Copilot it is the shared reference. It adds about 140 always-on tokens (measured 2026-10-16, Claude Code 2.1.302). |
| D24 | Each of the four `andes-documents` skills carries byte-identical copies of the logos and `brand.json` | A skill's scripts read only their own folder. The original lives in `andes-core/andes-brand`. |
| D25 | The audit's `sharedSkillFiles` is keyed by file, with a list of `plugin/skill` locations across plugins, the original first. Binary files (PNG) compare byte for byte | The shared files now span plugins and include images. `skills/shared-drift` was verified to catch a drifted logo copy. |
| D26 | The logo appears in every format, not only decks | A branded Word, Excel, or PDF file without the logo is half-branded. See Logo in every format. |
| D27 | `pptx_render.py` becomes `office_render.py` and renders .pptx, .docx, and .xlsx | Every format needs the visual review (D21). One shared file, identical in `andes-docx`, `andes-xlsx`, and `andes-pptx`. |

## The document designer agent

`copilot/andes-documents/com.github.copilot/agents/andes-document-designer.agent.md`. It covers Word, Excel, PowerPoint, and PDF and follows one process:

1. **Format.** Pick the format from the request, or build each one requested.
2. **Skill.** Load the matching skill (`andes-docx`, `andes-xlsx`, `andes-pptx`, or `andes-pdf`) and its design references.
3. **Structure first.** Write headings, sheets, or slide claims before any layout, so the structure reads as the argument.
4. **Layout plan.** Plan the layout per helper (the slide layout table in `andes-pptx/references/deck-design.md` for decks).
5. **Build.** Use the helpers only. The logo always comes from the helpers.
6. **Theme and check.** For Office files, `office_pkg.py theme`, then every structural check (`check`, `colors`, and the format's inspect script).
7. **Render and look.** `office_render.py` for Office files and `pdf_tools.py render` for PDF produce one PNG per page or slide. The agent views each PNG against the handover checklist.
8. **Fix.** Up to two rounds.

Hard rules: colors by role only; the logo only from the helpers; never invent data or put placeholders in the output; in a workbook, derived values are formulas; never overwrite an input; never install runtimes; say so when only structural checks were possible.

Report contract: File, Structure, QA, Assumptions, Open items.

## Brand assets and the `andes-brand` skill

`claude/andes-core/skills/andes-brand/` (mirrored to `copilot/andes-core/skills/andes-brand/`) contains `assets/logo/` (the three logos below), a copy of `assets/brand.json`, and a SKILL.md with:

- logo rules: which variant on which background, clear space, minimum sizes, never alter, alt text;
- the palette by role, with contrast rules;
- fonts;
- placement per format: deck, Word, Excel, PDF, web.

The `andes-core` description (both manifests and both marketplaces) now mentions the brand assets.

## Logo

The logos live in `andes-core/andes-brand/assets/logo/` and are copied byte for byte into `assets/logo/` of `andes-docx`, `andes-xlsx`, `andes-pptx`, and `andes-pdf` under `copilot/andes-documents/skills/`:

| File | Size | Use |
| --- | --- | --- |
| `andes-logo.png` | 667×470 | Full color, on white |
| `andes-mark.png` | 663×264 | Mountain mark only, for headers and footers |
| `andes-mark-white.png` | 662×263 | Mark reversed to white, for dark backgrounds |

They are derived from the 460-px GitHub organization avatar: the white background removed by color-to-alpha against white, then upscaled 2× bicubic. The resolution limit remains, so large or projected output may show softness. To fix it, replace every copy with official artwork under the same names. No code change is needed because sizes are read from the PNG header. `.gitattributes` marks `*.png` binary.

## Logo in every format

| Format | Where the logo goes | Helper |
| --- | --- | --- |
| PowerPoint | On the masters (see Deck masters and builders) | `pptx_brand.mjs` |
| Word | `titleBlock` opens with the full logo. `headerFooter` puts the mark at the left of every page header, title at the right, Glacier rule beneath | `docx_brand.mjs` |
| PDF | `document()` draws the full logo on the white part of the cover and the mark at the left of every body-page header | `pdf_brand.py` |
| Excel report sheet | `sheet_header(ws, title, subtitle=)` puts the mark in row 1, the title in row 2, an optional subtitle, hides gridlines, and returns the first free row | `xlsx_brand.py` |
| Excel data export | `about_sheet(wb, title, lines)` makes the first sheet, with the full logo, so data sheets keep their header in row 1 | `xlsx_brand.py` |
| Excel, anywhere else | `add_logo(ws, anchor, height_px=, variant=)` | `xlsx_brand.py` |

The xlsx skill now requires `Pillow>=10` alongside openpyxl, which openpyxl needs to embed images.

## Deck masters and builders

Masters carry the logo and left-align titles (they rendered centered before):

| Master | Layout |
| --- | --- |
| `ANDES_TITLE` | Navy panel (left 8.6 in) and the full-color logo on a white right panel |
| `ANDES_SECTION` | White mark at bottom left |
| `ANDES_CONTENT`, `ANDES_VISUAL` | Color mark in the footer, a footer rule, company name, slide number |

`pptx_brand.mjs` gains `agendaSlide`, `statSlide`, `columnsSlide`, `processSlide`, `imageTextSlide`, `quoteSlide`, `closingSlide`, `imageSize`, and `writeDeck`. `imageSlide` now fits images at their real aspect ratio, read from the PNG or JPEG header, instead of stretching them when no size is passed.

`writeDeck(pptx, file, { strict = true })` refuses to write while any recorded issue remains: too many bullets, overflow, text under 12 pt, missing alt text, a deck that does not open with a title slide, three bullet slides in a row, or bullets on more than half the content slides.

## Rendering and inspection

- **`office_render.py`.** Renamed from `pptx_render.py`. Renders .pptx, .docx, and .xlsx: LibreOffice converts to PDF, then pdftoppm (or pypdfium2 with Pillow as a fallback) writes one `page-NN.png` per slide or page. It exits 2 when a renderer is missing. It keeps LibreOffice's private profile in the short system temp folder, because LibreOffice crashed when the profile path neared the Windows MAX_PATH limit. The file is identical in `andes-docx`, `andes-xlsx`, and `andes-pptx`. PDFs are rendered with `pdf_tools.py render`.
- **QA by format.** Word and Excel QA now include the rendered visual review, like PowerPoint; "structural checks only" must be stated.
- **`pptx_inspect.py`.** New flags: stretched pictures (more than 2% off the native ratio). On decks built on the Andes masters it also flags slides off the masters, layouts without the logo, fonts other than Arial or Calibri, and Glacier Blue text on white layouts.
- **`office_pkg.py colors`.** Shared by `andes-docx`, `andes-xlsx`, and `andes-pptx`. It prints a `THEME` line and exits 10 when a theme part is not on the Andes color scheme (D22).
- **References.** New `andes-pptx/references/deck-design.md` covers storyline, a layout choice table, 60-30-10 color use, visual rules, and the handover checklist. `deck-layouts.md` adds logo placement and builder geometry and corrects the three-column grid to 3.689 in.

## Audit changes

`scripts/repo-audit.mjs` imports `COPILOT_ONLY`. For these plugins:

- Skill, shared-file, brand-contrast, and registry checks read `copilot/`.
- Their files get the harness-path, policy, and link scans.
- Only the Copilot manifest is required. It joins `manifests/version-lockstep` and the `--base` bump check.
- The Claude marketplace must not list them, and `marketplace-parity` ignores them.
- `isolation/tree-missing` exempts them.
- New error `manifests/copilot-only` fires if the plugin reappears under `claude/`.

`sharedSkillFiles` is now keyed by file and lists `plugin/skill` locations across plugins, original first (`andes-core/andes-brand` for `brand.json` and the logos). `skills/shared-drift` compares binary files byte for byte.

## Verified

- Audit clean, also with `--base main`: 32 skills, 6 Claude and 12 Copilot agents.
- `claude plugin validate --strict` on the marketplace and all 7 Claude plugins.
- Hook tests 19/19.
- A 14-slide sample deck using every builder was built, themed, and passed `check`, `colors`, and `pptx_inspect.py` with no flags. It was rendered through `office_render.py` with LibreOffice and reviewed visually.
- Sample Word, Excel (a report sheet, and an export with an About sheet), and PDF files were built, themed, passed `check` and `colors`, rendered with LibreOffice or `pdf_tools.py`, and reviewed visually. The logo is present as described in each.
- Negative tests: a skipped theme step produced the `THEME` finding; a stretched image, a non-Andes layout, a non-brand font, and Glacier Blue text on white were each flagged; strict `writeDeck` refused three consecutive bullet slides; `skills/shared-drift` caught a drifted logo copy.

## Not verified

- Copilot CLI loading and running `andes-document-designer`.
- Whether Copilot CLI's read tool shows PNGs to the model. If it does not, the agent reports that only structural checks were possible.
- Claude Code actually routing to `andes-brand` alongside its built-in document skills.
- Rendering on macOS and Linux.
- PowerPoint, Word, and Excel (rather than LibreOffice) rendering of the new masters and logos.

## Deferred

- Official logo artwork, preferably SVG, to replace the derived PNGs.
- The other `andes-documents` deferrals in the earlier record are unchanged.
