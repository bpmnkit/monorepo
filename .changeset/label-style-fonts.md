---
"@bpmnkit/core": minor
"@bpmnkit/canvas": patch
"@bpmnkit/editor": patch
---

Diagram labels now render in their `BPMNLabelStyle` font. A `BPMNLabel` whose `labelStyle`
references a `<bpmndi:BPMNLabelStyle>` is drawn in that style's `dc:Font` — family (with the
default stack behind it as fallback), size in px, bold, italic, underline and strike-through —
by the canvas, by `exportSvg`, and in the editor's inline label editor. Wrapping and line height
follow the resolved size, so a bigger or smaller font breaks lines accordingly; label positions
still come from the DI bounds. A label without a `labelStyle`, or with one that names no style,
keeps the default font: BPMN DI defines no diagram- or plane-level default style.

`@bpmnkit/core` (minor, new exports): `collectLabelStyles(defs)` indexes the document's label
styles by id, `resolveLabelFont(label, styles)` picks the one a DI label references, and
`labelFontCss(font, defaultFamily, defaultSize)` turns it into CSS values; types `BpmnLabelFont`
and `LabelFontCss`.

`@bpmnkit/canvas` (patch, a rendering fix): `RenderContext` gains an optional `labelStyles`,
filled by `buildRenderContext`.

`@bpmnkit/editor` (patch): moving an external label with `setLabelPosition` no longer drops the
label's `labelStyle` reference and other `BPMNLabel` attributes.
