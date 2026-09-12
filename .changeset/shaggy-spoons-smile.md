---
"@bpmnkit/editor": minor
---

`undo()` and `redo()` now emit `diagram:op` as a whole-document `snapshot`.

They previously said nothing, on the reasoning that they replace the document
rather than advance it. That was wrong for the case the event exists to serve:
a listener relaying edits to other people never heard about an undo, and was
silently wrong from then on. The command stack records states, not inverses, so
a snapshot is the smallest honest description available.

`loadDefinitions` still says nothing — that is the host replacing the document,
not the user changing it.
