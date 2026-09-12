---
"@bpmnkit/canvas": minor
---

`load` / `loadDefinitions` take a `keepViewport` option, for replacing the
document under a view someone is already looking at.

A new document is normally framed, which is right for a fresh canvas and wrong
for a diagram being edited elsewhere and redrawn on every change — the canvas
would jump out from under the reader each time. Restoring the viewport by hand
did not work: the fit is deferred a frame so the SVG has been laid out, so the
caller's `setViewport` landed first and was overwritten a moment later. The
option suppresses that one fit. Default behaviour is unchanged.
