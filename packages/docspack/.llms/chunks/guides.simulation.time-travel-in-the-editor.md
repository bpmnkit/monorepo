# Simulation — Time Travel in the Editor

The editor's play mode (the process-runner plugin) records every engine event of a run, and a
timeline scrubber above its tabs lets you move back through them:

- **Drag the scrubber** to any event. The Variables, FEEL and Errors tabs show the state as it
  was at that event, and the canvas redraws the tokens: elements holding a token then are
  marked active, elements already passed through are marked visited.
- **Live** returns to the latest event, with the tokens as it left them.
- **Re-run with these variables** starts a new run from the start event, with the variables as
  they were at the scrubbed event, which is the quickest way to try a different branch with
  the data a real run produced.

The state is projected from the recorded log, not by re-executing the process, so scrubbing is
instant and never calls a worker twice. A run keeps up to 10,000 events.

---
Source: https://bpmnkit.com/docs/guides/simulation
