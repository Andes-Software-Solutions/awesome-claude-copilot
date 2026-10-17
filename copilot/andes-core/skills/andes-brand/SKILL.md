---
name: andes-brand
description: "Use when making anything that carries the Andes brand (a document, deck, workbook, PDF, diagram, or web page), or when asked for the Andes logo, colors, or fonts: the logo files (full color, mark, and white mark) with placement rules, plus the Andes palette by role with WCAG-checked pairs. On Claude Code, pair it with the built-in docx, xlsx, pptx, and pdf skills."
---

# Andes brand

The source of truth for the Andes logo, palette, and fonts. `<skill>` below means the folder that holds this file. On Copilot with `andes-documents` installed, its skills apply all of this through their helpers, so use them. Everywhere else, including Claude Code's built-in document skills, apply it yourself from this page.

## Logo

| File | What it is | Use it on |
| --- | --- | --- |
| `<skill>/assets/logo/andes-logo.png` | Full logo: mark, "ANDES" wordmark, "Software Solutions LLC". Full color on a transparent background, 667 × 470 px. | White or Snow backgrounds: the cover, title slide, or first page or sheet |
| `<skill>/assets/logo/andes-mark.png` | Mountain mark, full color, transparent, 663 × 264 px | Running headers and footers on white or light surfaces |
| `<skill>/assets/logo/andes-mark-white.png` | The mark in white, transparent, 662 × 263 px | Summit Navy, Ink, or dark photo backgrounds only |

- **Every Andes deliverable carries the logo.** Put the full logo once on the cover, title slide, or first page. Put the mark in the running header or footer wherever the format has one.
- **Match the background.** Use full color on white or light surfaces, and the white mark on navy, Ink, or dark photos. Never place the full-color logo on a dark or busy background.
- **Never alter it.** Keep the aspect ratio, and never crop, recolor, rotate, outline, shadow, or animate it. Never put text or shapes over it.
- **Clear space.** Keep space around the logo of at least half the mark's height, and at least 0.15 inch at footer size.
- **Size.** Keep the mark at least 0.25 inch high and the full logo at least 1.5 inches wide. The files are raster images derived from a 460-pixel avatar, so never stretch the full logo beyond about 3.5 inches wide. No SVG exists.
- **Alt text.** Use "Andes Software Solutions logo", or mark it decorative when the format allows and the company name is already in the text.

## Palette

Read colors by role from `<skill>/assets/brand.json`, never by retyping hex values. The repository audit checks every pair listed under `contrast` against WCAG 2.2.

| Role | Hex | Name | Use |
| --- | --- | --- | --- |
| `primary` | `#14324f` | Summit Navy | Headings, title bars, table headers, links (always underlined) |
| `emphasis` | `#0b1f33` | Ink | Dark slides and panels |
| `body` | `#16283a` | | Body text on light backgrounds |
| `secondary` | `#5a6e82` | Slate | Captions, footers, axis labels, the "Other" series |
| `accent` | `#21a8d8` | Glacier Blue | Rules, bars, and decorative fills; text only on navy or Ink |
| `accentStrong` | `#0e7fa8` | | Chart series and icons; text only on white |
| `success` / `successFill` | `#2e9c58` / `#3fb56a` | Andes Green / logo green | Positive values and chart series; logo-green accents on dark slides |
| `warning`, `danger` | `#9c6210`, `#c0392b` | | Warnings, and errors or negative values only |
| `page`, `surface`, `surfaceAlt`, `surfaceSubtle`, `border` | `#ffffff`, `#f7fafc`, `#e7eff7`, `#eff4f9`, `#dce5ee` | Page, Snow, and lighter fills | Backgrounds, panels, table banding, and rules |

- **Contrast.** On navy or Ink, text is white, Glacier Blue, or the logo green. On white, text is navy, body, accentStrong, or Slate. Glacier Blue on white is decoration only. Andes Green on white is for text 24 pt or larger.
- **Charts.** Series follow `brand.series`: Summit Navy, Andes Green, accentStrong, warning, then Slate. Use at most five series, and group the rest as "Other".
- **Proportions.** White and Snow are the canvas, navy carries the structure, and Glacier Blue and green are accents. Use no gradients and no off-palette colors.

## Fonts

- **Office files:** Arial for headings and Calibri for body text. Recipients already have both.
- **PDF and web:** Montserrat for headings and Inter for body text. On Copilot, `andes-pdf` bundles and embeds them. Elsewhere, embed them or fall back to Arial and Calibri.

## Placement by format

Use these placements when no Andes helper places the logo for you:

- **Deck (16:9):**
  - Title slide: a Summit Navy panel on the left two thirds holds the title, and the full logo sits centered on white in the right third.
  - Section slides: Ink, with the white mark at the bottom left.
  - Content slides: white, with the mark, the company name, and the slide number in the footer, and a 28 pt navy title over a Glacier accent bar.
- **Word:** the full logo above the title on the cover. On every page, the mark at the left of the header, the document title on the right, and a Glacier rule under both.
- **Excel:** report and dashboard sheets start with the mark in row 1 and the title in row 2. A workbook of plain data exports keeps each header in row 1 and gets a first "About" sheet that carries the logo, the title, and the source.
- **PDF:** a Summit Navy cover band with the title in white, the full logo on the white part of the cover, and the mark at the left of the running header.
- **Web pages and diagrams:** colors by role, the full logo on light backgrounds, and the white mark on dark ones.
