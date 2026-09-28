# AI Integration — Previewing While the Model Writes — Frames are advisory

Every frame is a guess at an unfinished document. `push` never throws, drops what it cannot
place, and strips a flow's `isDefault` rather than failing when the gateway it claims has not
arrived. That is the whole bargain: a frame that guesses wrong costs one render, so the
authoritative result is whatever the model finishes with, and that is what you save or deploy.

---
Source: https://bpmnkit.com/docs/guides/ai
