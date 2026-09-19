# @bpmnkit/ascii — Overview

`@bpmnkit/ascii` turns a diagram into text. It takes the XML and returns a string — no canvas,
no DOM, no headless browser — so a process can be shown somewhere a picture cannot go: a
terminal, a CI log, a pull-request comment, or a prompt.

That last one is the reason it exists. A model reading a diagram as a grid of labelled boxes
gets the topology in a few hundred tokens, which is a great deal cheaper than the XML and a
great deal more legible than a screenshot. `casen view` is this package with a file path in
front of it.

Three renderers, one per artifact kind, and no dependencies beyond `@bpmnkit/core`.

---
Source: https://bpmnkit.com/docs/packages/ascii
