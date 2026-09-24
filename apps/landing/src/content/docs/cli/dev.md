---
title: casen dev
description: One command for the local development loop — edit every process in a folder in the browser, simulate it, and re-run lint and scenario tests on every save. No Docker, no cluster, no licence key.
sidebar:
  order: 9
---

`casen dev` turns a folder of `.bpmn`, `.dmn` and `.form` files into a local development
environment. It starts a small web server, opens the BPMN Kit editor in your browser, and
re-checks each file every time it changes — whether you saved it in the browser or in another
editor.

```sh
casen dev              # the current folder
casen dev ./processes  # another folder
```

```
  casen dev  /home/me/shop
  UI        http://127.0.0.1:4747/
  files     3 (2 bpmn, 1 dmn, 0 form)
  scenarios @bpmnkit/engine

✖ orders/order.bpmn  lint 0✖ 2⚠  tests 1/2
    FAIL out of stock
      variables.inStock: expected false, got true
✓ orders/refund.bpmn  lint 0✖ 0⚠
✓ risk-score.dmn
  3 files · 1 failing: orders/order.bpmn
  Watching for changes. Ctrl+C to stop.
```

## What you get

- **A file list.** Every `.bpmn`, `.dmn` and `.form` file under the folder, with a green or red
  mark for its last check. Hidden directories, `node_modules`, `dist`, `build`, `target`,
  `coverage` and `out` are skipped.
- **The editor.** BPMN opens in the full diagram editor with in-canvas lint markers; DMN in the
  decision editor; forms in the form editor.
- **Simulation.** The Play button runs the diagram in the browser on `@bpmnkit/engine`, with
  tokens drawn on the elements they sit on. DMN files in the same folder are deployed with it,
  so business rule tasks evaluate.
- **Saving back to disk.** Edits are written about half a second after you stop, or at once with
  <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd>. Each save is written into the file that is
  already there, keeping its indentation, attribute order and comments, and is only used if it
  reads back as the same model — the same writer as the [VS Code extension](/docs/guides/vscode),
  so moving a box changes the lines for that box, not the whole file.
- **Live reload.** Change a file anywhere else — your text editor, `git checkout`, a code
  generator — and the open diagram reloads. If you have unsaved edits in the browser at the same
  time, nothing is thrown away: you choose between reloading and overwriting.
- **Checks on every change.** Each changed BPMN file is linted exactly as
  `casen lint` would lint it (including a project `.bpmnlintrc`), and the
  scenarios in its `<file>.bpmn.tests.json` sidecar are run as `casen test` runs them. Changing a
  `.dmn` file re-runs the scenarios of the processes beside it. Results appear in the browser's
  Checks panel and in the terminal.
- **Tests you can edit.** The Tests tab of Play mode reads and writes the same
  `.bpmn.tests.json` sidecar, so scenarios written in the browser are the ones `casen test` runs
  in CI.

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--port <n>` | `4747`, or the next free port | Port to listen on. An explicit port that is taken is an error. |
| `--no-open` | opens the browser | Print the URL without opening a browser. |
| `--engine ts\|wasm` | `ts` | Engine for the scenario runs after each save. `wasm` runs them on Reebe compiled to WebAssembly, for Zeebe semantics — the engine `casen test` uses. Simulation in the browser always uses `@bpmnkit/engine`. |

## Deploying and AI

`casen dev` does not start the AI bridge or connect to a cluster. For those, run the proxy
alongside it:

```sh
casen proxy start   # port 3033: AI bridge, Camunda API proxy, run history
casen deploy ...    # deploy what you built
```

## Security

The server only listens on `127.0.0.1`. It answers only requests addressed to a loopback host
name, which stops DNS-rebinding pages, and every API call needs a random token that exists only
inside the page it served, so other sites open in the same browser cannot read or write your
files. Reads and writes are limited to `.bpmn`, `.dmn`, `.form` and `.bpmn.tests.json` files
inside the project folder: paths that climb out of it, hidden paths and symlinks pointing
outside it are refused. Nothing is ever executed on your behalf.
