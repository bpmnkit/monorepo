# BPMN Diagrams in Markdown — Theming

The SVG reads the same tokens as every other BPMN Kit surface — `--bpmnkit-bg` for the
ground, `--bpmnkit-surface` for shape fills, `--bpmnkit-fg` for strokes and labels,
`--bpmnkit-font` for type — each with a light and a dark fallback. A site that defines the
tokens gets a diagram in its own palette; one that does not gets the BPMN Kit palette in the
reader's colour scheme.

The switch is CSS `light-dark()` under `color-scheme: light dark`, written into `style`
attributes rather than a `<style>` element. An inline SVG's `<style>` applies to the whole
page, and Vue templates (VitePress) drop it entirely; attributes have neither problem. It
needs a browser from 2024 or later.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
