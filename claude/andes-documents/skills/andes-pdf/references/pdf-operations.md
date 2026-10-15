# PDF operations

Every command is `<venvPython> -B <skill>/scripts/pdf_tools.py …`. Page numbers are 1-based, and ranges look like `1-3,5`.

## Forms

1. `fields <pdf>` lists each field with its type and current value. Checkboxes and radio buttons list their allowed values under `options` (for example `/Off`, `/Yes`).
2. Write a JSON object of field names to values. Use the exact option string for checkboxes, such as `"/Yes"`.
3. `fill <pdf> <out> --data values.json` fills the fields and sets the flag that makes viewers redraw them. It warns about, and exits 10 for, any name that matches no field.
4. Run `fields <out>` again to confirm the values.

A PDF with no fields (`fields` exits 10) is a flat form. Filling it means writing text at coordinates, which this version does not support. Tell the user, and offer a typed-up version as a new branded PDF instead.

## Extracting content

- **Text.** `text <pdf> --layout` keeps the column layout. Leave it off for running text.
- **Tables.** `tables <pdf> --csv-dir <work>/tables` writes one CSV per table. When a table has no vertical rules (Andes PDFs, most reports), add `--text-columns`, then check the CSV: header rows and cells that wrap across lines may need cleanup.
- **Scanned PDFs.** If `text` returns nothing for a page that shows text, the page is an image. OCR is not in this version, so tell the user.

## Page operations

```shell
pdf_tools.py merge <work>/combined.pdf cover.pdf report.pdf appendix.pdf
pdf_tools.py split report.pdf <work>/parts --ranges 1-2,3-10,11-12
pdf_tools.py rotate scan.pdf <work>/scan-rotated.pdf --degrees 90 --pages 2,4
pdf_tools.py stamp report.pdf <work>/report-draft.pdf --text DRAFT
pdf_tools.py stamp report.pdf <work>/report-letterhead.pdf --pdf letterhead.pdf --pages 1
```

Merging keeps each input's bookmarks and links. A stamp is drawn on top of the page, so use a mostly transparent overlay for letterheads.

## Encryption

```shell
# PowerShell: $env:PDF_PASSWORD = Read-Host -MaskInput   bash: read -rs PDF_PASSWORD; export PDF_PASSWORD
pdf_tools.py encrypt report.pdf <work>/report-locked.pdf --password-env PDF_PASSWORD
pdf_tools.py decrypt locked.pdf <work>/unlocked.pdf --password-env PDF_PASSWORD
```

Ask the user to set the variable themselves. Never type, echo, or log the password.

## Redaction requests

Covering text with a black box does not remove it, because the text stays extractable underneath. True redaction is not in this version. Tell the user, and suggest a redaction tool such as Acrobat's.

## Large files

`text`, `tables`, and `render` accept `--pages`, so work on a range at a time. `info` reads only the document structure and is safe on large files.
