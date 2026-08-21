# casen view

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

---
Source: https://docs.bpmnkit.com/cli/view/
