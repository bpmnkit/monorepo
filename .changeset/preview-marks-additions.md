---
"@bpmnkit/plugins": minor
---

The AI panel outlines what the AI is adding, leaving the diagram it was handed plain. A preview frame shows the process being written but not which part of it was already there, so an edit read the same as a rewrite.

The marking is applied to every frame, because `load` clears highlights, and to the authoritative render at the end of the message too — otherwise it would vanish at the moment the result arrives.

`additionsToMark(before, rendered)` decides it, and returns nothing when there is no process to contrast with. That is read as no sequence flow rather than no element: a new file in the editor is one unconnected start event, and marking everything the model then writes says no more than marking none of it, while flickering on for the length of every stream and off again at the end.
