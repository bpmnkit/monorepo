# casen dev — Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--port <n>` | `4747`, or the next free port | Port to listen on. An explicit port that is taken is an error. |
| `--no-open` | opens the browser | Print the URL without opening a browser. |
| `--engine ts\|wasm` | `ts` | Engine for the scenario runs after each save. `wasm` runs them on Reebe compiled to WebAssembly, for Zeebe semantics — the engine `casen test` uses. Simulation in the browser always uses `@bpmnkit/engine`. |

---
Source: https://bpmnkit.com/docs/cli/dev
