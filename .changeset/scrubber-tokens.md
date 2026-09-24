---
"@bpmnkit/plugins": patch
---

The process runner's timeline scrubber now redraws the canvas as well as the tabs: at a
scrubbed event, the elements holding a token then are shown active and the ones already
passed through as visited, and **Live** restores the tokens as the latest event left them.
The button that starts a new run from the scrubbed variables is renamed from "Replay from
here" to **Re-run with these variables**, which is what it does — it starts again at the start
event.
