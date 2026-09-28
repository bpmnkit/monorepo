---
"@bpmnkit/cli": minor
---

`casen dev [dir]` is a one-command local development loop. It needs no Docker, no cluster and no licence key. It finds every `.bpmn`, `.dmn` and `.form` file in the folder and serves a local web UI on `127.0.0.1` (port 4747 by default, `--port`). The UI opens each file in the BPMN Kit editor, with in-browser simulation on `@bpmnkit/engine` and the Tests tab bound to the `.bpmn.tests.json` sidecar. Saves are written back to disk into the existing file with its formatting kept, and each save is read back to check it. Changes made on disk reload the open diagram. Every change re-runs lint (the same analysis as `casen lint`, including a `.bpmnlintrc`) and the file's scenarios. Results show in the browser and as a compact status list in the terminal. `--engine wasm` runs the scenarios on reebe-wasm for Zeebe semantics. `--no-open` skips opening the browser. The UI is pre-bundled into the package's `dist`, so it adds no runtime dependencies.
