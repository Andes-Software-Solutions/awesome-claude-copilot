# Deck design

What makes an Andes deck look professional, and the checklist every deck passes before handover. The masters and helpers handle the brand mechanics. This page covers the decisions they cannot make for you.

## Storyline first

1. **Know the audience and the ask.** Before you write a slide, write one sentence that says who the deck is for and what it should make them do. If the brief does not say, infer it and state the assumption in your report.
2. **Write the titles as a story.** List the slide titles alone and read them in order. Each one is a complete claim ("Churn fell to 3% after onboarding changes"), and together they make the argument without the body text. A title that only names a topic ("Churn") gets rewritten.
3. **Shape.** Open with `titleSlide`. Add `agendaSlide` for eight slides or more, `sectionSlide` between parts, and a closing slide with the ask or next steps. Most decks need 8 to 15 slides; one idea never takes two slides.
4. **Facts are given, never invented.** Every number, quote, name, and date comes from the user or their files. When data is missing, leave the claim out, and list the gap in your report and in the speaker notes. Never put placeholder text such as "TBD" or "Lorem ipsum" on a slide.

## Pick the layout for the content

| The content is | Use |
| --- | --- |
| Two to four headline numbers | `statSlide` |
| A trend, comparison, or share | `chartSlide` (line for time, column or bar for categories, doughnut for share of a whole with up to five parts) |
| Options, before and after, or pros and cons | `columnsSlide` |
| A sequence, plan, or timeline | `processSlide` |
| Exact values people will look up | `tableSlide`, with up to about 8 rows and 5 columns per slide |
| A photo, screenshot, or diagram | `imageSlide`, or `imageTextSlide` when it needs explaining |
| A customer or leader quote | `quoteSlide` |
| Points that only make sense as a list | `bulletSlide`, with three to five bullets |

**Rhythm.** Alternate dense and light slides, and use visuals for at least half of the content slides. `writeDeck` stops on three bullet slides in a row, or when more than half of the content slides are bullets.

## Visual rules

- **Color proportions, about 60-30-10.** White and Snow are the canvas, navy carries the structure and the text, and Glacier Blue and Andes Green are accents. Use green for positive values, danger for negative values, and each only for that meaning.
- **Whitespace is part of the design.** Keep the 0.6-inch margins and the body zone. Leave room around tiles and columns rather than filling the slide. When something does not fit, split the slide; never shrink text below the type scale.
- **Alignment.** Every element sits on the grid in [deck-layouts.md](deck-layouts.md): left edges at x = 0.6 or on a column line, and tops aligned across a row. Do not center body text, except in stat tiles, process steps, and short captions.
- **Emphasis.** Use one emphasis per slide: bold or a brand color, not both, never underline (it means a link), and never all caps for sentences.
- **Images.** Use real photos, screenshots, or diagrams at 1600 px or wider, fitted at their own ratio. Never use clip art, stock icons that add nothing, or text baked into an image.
- **Never:** emoji, WordArt, gradients, drop shadows, 3-D charts, borders around the whole slide, more than two fonts, or decoration that competes with the content.
- **The logo is already on every slide.** Never place it again, enlarge it, or put content over it.

## Handover checklist

Look at every rendered slide (`office_render.py`) and confirm:

- [ ] The title states the point, reads in one or two lines, and does not collide with the accent bar.
- [ ] Nothing overflows, overlaps, or touches the margins, the footer rule, or the logo.
- [ ] Text is legible from a distance: 18 pt body, never under 12 pt, and dark text on light or white on dark.
- [ ] Colors come from the palette and carry the same meaning on every slide.
- [ ] Every chart has a takeaway title, readable labels, at most five series, and a source line when the data has one.
- [ ] Images are sharp, not stretched, and have alt text.
- [ ] The deck opens with the title slide and ends with a clear ask or next steps.
- [ ] The speaker notes hold the detail that was cut from the slides.
- [ ] No placeholder text and no invented data anywhere.
