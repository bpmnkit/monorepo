---
"@bpmnkit/editor": minor
---

Add a `@bpmnkit/editor/headless` entry point: `applyOp`, the id factories, and
the types an op is built from, with nothing that touches the DOM.

The package root reaches for `document` the moment it is imported — it is an
editor. The part that decides *what an edit does* never does, and has to run
where there is no DOM at all: a server replaying a writer's op to verify it, or
a viewer applying one without an editor loaded. Importing the root there would
pull the canvas in behind it; this subpath will not.
