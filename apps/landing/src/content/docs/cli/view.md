---
title: casen view
description: View BPMN, DMN, and Camunda form files in the browser via a local server.
sidebar:
  order: 3
---

`casen view` spawns a local HTTP server and opens the system browser to display BPMN diagrams,
DMN decision tables, and Camunda forms. All rendering happens server-side — no browser plugins required.

## Commands

```
casen view
├── open    — view any mix of .bpmn, .dmn, and .form files (auto-detects type)
├── bpmn    — view BPMN files rendered as SVG
├── dmn     — view DMN decision tables
└── form    — view Camunda form layouts
```

## Subcommands

### `casen view open`

Accepts any combination of `.bpmn`, `.dmn`, and `.form` files or directories. File type is
detected automatically from the extension.

```sh
# Mixed file types
casen view open order.bpmn routing.dmn review.form

# Entire project folder — all supported files get tabs
casen view open ./project/

# Mix files and folders
casen view open ./processes/ extra.dmn review.form
```

### `casen view bpmn`

Renders BPMN diagrams server-side as SVG using `exportSvg` from `@bpmnkit/core`.

```sh
# Single file
casen view bpmn process.bpmn

# All .bpmn files in a folder
casen view bpmn ./processes/

# Multiple specific files
casen view bpmn order.bpmn payment.bpmn shipping.bpmn
```

### `casen view dmn`

Renders DMN decision tables as ASCII art in a monospace panel.

```sh
casen view dmn eligibility.dmn
casen view dmn ./decisions/
```

### `casen view form`

Renders Camunda form layouts (`.form` files) as ASCII art in a monospace panel.

```sh
casen view form approval.form
casen view form ./forms/
```

## Folder support

Pass a directory instead of individual files. The viewer scans the top level of the directory
for files with the matching extension and gives each one its own tab.

```sh
# All .bpmn files in ./processes/
casen view bpmn ./processes/

# All supported types in ./project/
casen view open ./project/
```

## Flags

All subcommands accept the same flags:

| Flag | Description | Default |
|---|---|---|
| `--port` | Port for the local server | `3044` |
| `--theme` | Color theme: `light` or `dark` | `light` |
| `--no-open` | Do not open the browser automatically | `false` |

```sh
# Dark theme on a custom port without auto-opening
casen view bpmn process.bpmn --theme dark --port 8080 --no-open
```

## Tabbed navigation

When multiple files are loaded, the viewer renders a tab bar at the top. Click a tab to switch
diagrams. Tabs show the filename and are colour-coded by type (BPMN / DMN / Form).

## Stopping the server

Press `Ctrl+C` in the terminal where `casen view` is running. The server shuts down cleanly.

## Usage in an AI workflow

```sh
# Generate a process, then immediately view it
casen generate bpmn --template approval --process-id approve
casen view bpmn approve.bpmn

# Inspect a folder of processes together
casen view open ./processes/

# After patching an existing file, verify the result
casen generate bpmn --input order.bpmn --patch '...'
casen view bpmn order.bpmn --no-open --port 3044
```
