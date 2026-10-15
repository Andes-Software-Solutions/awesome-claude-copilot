# Deck layouts

The slide is 13.333 × 7.5 inches (`LAYOUT_WIDE`, 16:9). Every position is in inches, measured from the top-left corner.

## Grid

| Zone | x | y | w | h |
| --- | --- | --- | --- | --- |
| Title | 0.6 | 0.4 | 12.133 | 0.8 (bottom-aligned) |
| Accent bar | 0.6 | 1.25 | 1.2 | 0.06 |
| Body | 0.6 | 1.5 | 12.133 | 5.2 |
| Footer: company and slide number | 0.6 and 12.133 | 6.95 | — | 0.3 |

For two columns, split the body into two 5.8-inch columns with a 0.533-inch gutter: x = 0.6 and x = 6.933. For three, use 3.7-inch columns at x = 0.6, 4.817, and 9.033.

## Type scale

| Element | Font | Size |
| --- | --- | --- |
| Title-slide title | Arial bold | 40 pt |
| Section title / number | Arial bold | 36 / 54 pt |
| Slide title | Arial bold, navy | 28 pt |
| Body / sub-point | Calibri | 18 / 16 pt |
| Table text | Calibri | 14 pt |
| Source line, captions | Calibri, Slate | 12 pt |
| Footer | Calibri, Slate | 10 pt (the only text under 12 pt) |

## Custom slides

Start a custom slide from `ANDES_VISUAL` (title only) and place shapes in the body zone:

```js
const slide = pptx.addSlide({ masterName: a.MASTERS.visual });
slide.addText('Three things changed', { placeholder: 'title' });
const hex = (role) => brand.colors[role].hex.slice(1);
[['12%', 'pipeline growth'], ['4', 'new accounts'], ['70k', 'West, from 45k']].forEach(([big, label], i) => {
  const x = 0.6 + i * (3.7 + 0.517);
  slide.addShape(pptx.ShapeType.rect, { x, y: 2.0, w: 3.7, h: 3.0, fill: { color: hex('surface') }, line: { color: hex('border'), width: 0.75 } });
  slide.addText(big, { x, y: 2.3, w: 3.7, h: 1.4, align: 'center', fontFace: 'Arial', fontSize: 54, bold: true, color: hex('primary') });
  slide.addText(label, { x, y: 3.8, w: 3.7, h: 0.8, align: 'center', fontFace: 'Calibri', fontSize: 18, color: hex('body') });
});
```

- **Big numbers** (stat tiles) use navy on Snow. Use Andes Green only at 24 pt or larger, because it is under 4.5:1 on white.
- **Comparison slides** (two columns) get a heading per column in 20 pt Arial navy.
- **Quote slides** use `ANDES_SECTION` with the quote as the title and the speaker in a 16 pt Glacier Blue text box.

## Images

- Use PNG or JPEG, at least 1600 px wide for a full-width image.
- `imageSlide` keeps the aspect ratio from `widthIn`/`heightIn` and centers the image in the body.
- Decorative images still need alt text that says they are decorative ("Decorative mountain photo").
