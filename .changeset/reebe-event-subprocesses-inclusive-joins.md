---
"@bpmnkit/reebe-wasm": patch
---

Timer, message and signal event sub-processes now run. Their start events are armed when the process or sub-process that contains them starts (timers and correlation keys evaluated with FEEL against that scope) and disarmed when it ends. An interrupting one terminates the rest of its scope, triggers once and disarms the others; a non-interrupting one runs alongside each time its event occurs, and a timer cycle repeats. The message or signal variables are visible inside. An inclusive gateway join now waits until no token in its scope can still reach one of its untaken incoming flows, the split takes its default flow only when no condition holds (and raises an incident when there is none), and a token waiting at a parallel or inclusive join keeps its scope active, as in Zeebe.
