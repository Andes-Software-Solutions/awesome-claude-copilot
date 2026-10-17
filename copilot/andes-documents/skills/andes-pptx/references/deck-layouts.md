# Deck layouts

The slide is 13.333 × 7.5 inches (`LAYOUT_WIDE`, 16:9). Every position is in inches, measured from the top-left corner.

## Grid

| Zone | x | y | w | h |
| --- | --- | --- | --- | --- |
| Title | 0.6 | 0.4 | 12.133 | 0.8 (left- and bottom-aligned) |
| Accent bar | 0.6 | 1.25 | 1.2 | 0.06 |
| Body | 0.6 | 1.5 | 12.133 | 5.2 |
| Footer rule | 0.6 | 6.82 | 12.133 | — |
| Footer: mark, company, slide number | 0.6, 1.503, and 12.133 | 6.95 | — | 0.3 |

For two columns, split the body into two 5.8-inch columns with a 0.533-inch gutter: x = 0.6 and x = 6.933. For three, use 3.689-inch columns at x = 0.6, 4.822, and 9.044. `columnsSlide`, `imageTextSlide`, and `agendaSlide` use these lines.

## Logo

The masters place the logo; slides never do.

| Master | File (`assets/logo/`) | Position | Size |
| --- | --- | --- | --- |
| `ANDES_TITLE` | `andes-logo.png`, full color | Centered in the white panel right of x = 8.68 | 3.3 wide at most |
| `ANDES_SECTION` | `andes-mark-white.png` | x 0.6, y 6.55 | 0.45 high |
| `ANDES_CONTENT`, `ANDES_VISUAL` | `andes-mark.png`, full color | x 0.6, y 6.95 | 0.3 high |

On the title master, the navy panel covers x = 0 to 8.6, with a 0.08-inch Glacier stripe at its edge. Title-slide text stays inside x = 0.6 to 8.0. Keep the area around each logo clear: nothing within 0.15 inch of the footer mark, and nothing in the white panel of the title master.

The files are derived from the 460-pixel organization avatar: full color on a transparent background, and the mark reversed to white for dark slides. Replacing a file with official artwork of the same name needs no code change, because the helpers read each file's size.

## Type scale

| Element | Font | Size |
| --- | --- | --- |
| Title-slide title | Arial bold | 40 pt |
| Section title / number | Arial bold | 36 / 54 pt |
| Quote | Arial bold, white | 28 pt |
| Slide title | Arial bold, navy | 28 pt |
| Stat value | Arial bold, navy | 54 pt (44 pt with four tiles) |
| Agenda number | Arial bold, accentStrong | 28 pt |
| Column heading / process label | Arial bold, navy | 20 / 18 pt |
| Body / sub-point | Calibri | 18 / 16 pt |
| Three-column body, process detail | Calibri | 16 pt (14 pt with five or six steps) |
| Table text, stat detail | Calibri | 14 pt |
| Source line, captions | Calibri, Slate | 12 pt |
| Footer | Calibri, Slate | 10 pt (the only text under 12 pt) |

## Builder geometry

- **`statSlide`:** tiles start at y = 1.9 and are 3.8 high with a 0.4 gap, on Snow with a border and a Glacier top bar. The value sits at y + 0.45, the label at y + 1.85, and the detail at y + 2.65.
- **`processSlide`:** the timeline runs at y = 2.5 between the first and last step centers, with 0.8-inch navy circles. Labels sit at y = 3.2 and details at y = 3.95.
- **`agendaSlide`:** rows are up to 1.1 high from y = 1.8, with a border rule under each row and a second column after four items.
- **`quoteSlide`:** a 96 pt Glacier quotation mark at y = 1.3, the quote in the section title placeholder (y = 3.4), and the speaker in 16 pt Glacier Blue below it.
- **`closingSlide`:** the title master, with the subtitle at y = 3.85 and contact lines at y = 4.9.

## Custom slides

Prefer a builder. When none fits, start from `ANDES_VISUAL` (title only), place shapes in the body zone, and pass every color by role:

```js
const slide = pptx.addSlide({ masterName: a.MASTERS.visual });
slide.addText('Coverage now spans four states', { placeholder: 'title' });
const hex = (role) => brand.colors[role].hex.slice(1);
slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.9, w: 12.133, h: 1.2, fill: { color: hex('surface') }, line: { color: hex('border'), width: 0.75 } });
slide.addText('Colorado, Utah, Idaho, and Montana', { x: 0.9, y: 1.9, w: 11.5, h: 1.2, valign: 'middle', fontFace: 'Calibri', fontSize: 20, color: hex('body') });
```

- **Big numbers** use navy on Snow. Use Andes Green only at 24 pt or larger, because it is under 4.5:1 on white.
- Check custom text with `estimateLines` and `checkFontSize`, so `writeDeck` sees the issues.

## Images

- Use PNG or JPEG, at least 1600 px wide for a full-width image.
- `imageSlide` and `imageTextSlide` read the image's pixel size and fit it at its own ratio. Pass `widthIn` and `heightIn` only for other formats.
- Decorative images still need alt text that says they are decorative ("Decorative mountain photo").
