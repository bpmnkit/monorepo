---
title: VS Code Extension
description: View, edit, compare and analyse BPMN, DMN and Camunda Form files inside VS Code — the same renderer, linter and engine the rest of BPMN Kit uses, with no bpmn.io and no round-trip rewrites of your XML.
sidebar:
  order: 13
---

**BPMN Kit for VS Code** puts the toolkit where the code already is. It renders `.bpmn`,
`.dmn` and `.form` files, reports the same findings `casen lint` reports, compares a diagram
against `HEAD`, runs the process without a cluster, and edits the file without reformatting
it.

The renderer is [`@bpmnkit/canvas`](/docs/packages/canvas), the same from-scratch BPMN 2.0
implementation the website and the browser editor use. There is no bpmn.io anywhere in the
extension, which is the point: the files it shows you are the files git has, byte for byte.

## Installing

Every version is attached as a `.vsix` to a
[GitHub Release](https://github.com/bpmnkit/monorepo/releases?q=vscode-v) tagged
`vscode-v<version>`. Download it and install it with **Extensions → … → Install from VSIX…**,
or from a terminal:

```sh
code --install-extension bpmnkit-<version>.vsix
```

The same release workflow publishes to the Visual Studio Marketplace and Open VSX as
`bpmnkit.bpmnkit`; those listings are being set up, and this page will link them once they
are live.

To build it yourself from the monorepo:

```sh
git clone https://github.com/bpmnkit/monorepo
cd monorepo && pnpm install
pnpm turbo build --filter bpmnkit...
pnpm --filter bpmnkit package     # → apps/vscode/bpmnkit.vsix
```

It activates on a workspace containing a `.bpmn` file, and requires VS Code 1.90 or newer.

## What it does

### Preview beside the source

`.bpmn`, `.dmn` and `.form` all render, with a minimap and zoom for BPMN. The preview
follows the buffer as you type rather than on save, and when the XML is momentarily
unparseable it keeps the last drawing that worked rather than blanking.

The text editor stays the default for all three file types. Open the diagram with
**BPMN Kit: Open Diagram to the Side**, with *Reopen Editor With…*, or make it your default
through `workbench.editorAssociations`.

### Editing that leaves a readable diff

The diagram editor is a **text** custom editor: it edits the same `TextDocument` a text
editor would open. The file is dirty when the document is, <kbd>Ctrl</kbd>+<kbd>S</kbd>
saves it, hot exit restores it, undo is the editor's own undo, and a text editor open on the
same file is a second view of one document rather than a competing copy. Type in the XML and
the diagram follows; move a box and the XML follows.

Saving writes a diff a reviewer can read. A visual editor normally serialises the whole
model, which reformats the file on the first change and buries one edit in a rewrite of
everything. This one writes the file that was already there: renaming a task changes the
line with the task on it, moving a box changes two numbers, and your indentation, attribute
order and comments come back untouched. Opening a diagram and saving it without editing
anything leaves the file byte for byte. Form files get the same treatment — indentation, key
order and trailing newline all survive.

That behaviour is not extension-specific; it is
[`exportPreserving()`](/docs/packages/core#exportpreservingoriginal-definitions) from
`@bpmnkit/core`, available to anything that writes a model back over a file it parsed.

### Findings in the Problems panel

The same static analysis `casen lint` runs — flow reachability, naming, FEEL syntax, data
flow, Camunda 8 deployability — reported against the element that caused it, so clicking a
problem takes you to the tag rather than to line 1.

The analysis matches the file. A diagram that declares no `modeler:executionPlatform` is not
judged against Camunda 8 deployability, because "this service task has no
`zeebe:taskDefinition`" is not a defect in a diagram that was never going to be deployed to
Zeebe. Turn on `bpmnkit.lint.forceEngineRules` to apply those rules anyway.

### A visual diff in Source Control

Right-click a `.bpmn` file in Source Control to see it against `HEAD`, or select exactly two
in the Explorer to compare them with each other. Added, removed, changed and moved elements
are marked on synchronised canvases — a moved element reads as *moved*, not as two unrelated
pictures. The text diff stays where it was; this is a second view of the same change, not a
replacement for the first. The same comparison is available as
[`casen diff bpmn`](/docs/cli/diff) and on a [drop](/docs/guides/drop).

### Run the diagram in the editor

[`@bpmnkit/engine`](/docs/packages/engine) is a BPMN engine written in TypeScript, so the
preview does not need a cluster to execute what is on screen. Press **Run** and watch tokens
move; press **One Step** to advance the instance one element at a time, reading the variables
as they change. Nothing is deployed and nothing leaves your machine.

### A FEEL playground on your selection

Select an expression anywhere in the XML and open the playground: it comes up pre-filled,
with a context you can edit and the result evaluated as you type. Unary tests too, for
decision-table input entries.

### Deploy against your own clusters

Deployment targets come from `casen`'s profile store — the same file
[`casen profile create`](/docs/cli/casen#connection-profiles) writes — so there is no second
place to configure a cluster and no credentials in your workspace settings:

```sh
casen profile create staging --base-url https://<cluster>.camunda.io/<id> \
  --auth-type oauth --client-id … --client-secret …
```

Every `c8` profile then appears in the extension. Deploy the open file, or deploy and start
an instance with variables; the instance key comes back in a notification. Deploy-and-start
also offers the payloads it finds in `.camunda/payloads/*.json`, walking up from the diagram,
so the inputs a process is always tried with are a pick rather than a paste.

Credentials are read only to sign the request — nothing in the extension stores, displays or
logs them.

### Copy the diagram as text

For a code review, where a picture cannot go. **BPMN Kit: Copy Diagram as ASCII** renders the
layout into a fenced block that pastes into a pull request, an issue or a commit message,
dedented so the diagram is not mostly margin.

## Commands

| Command | Where |
| --- | --- |
| **BPMN Kit: Open Diagram to the Side** | Editor title bar, command palette |
| **BPMN Kit: Compare Diagram with HEAD** | Source Control context menu, editor title bar |
| **BPMN Kit: Compare Diagrams Visually** | Explorer, with exactly two `.bpmn` files selected |
| **BPMN Kit: Open FEEL Playground** | Command palette — pre-filled from the selection |
| **BPMN Kit: Copy Diagram as ASCII** | Editor title bar, Explorer, command palette |
| **BPMN Kit: Deploy to Camunda 8** | Command palette |
| **BPMN Kit: Deploy and Start Instance** | Explorer, command palette |

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `bpmnkit.lint.enabled` | `true` | Report findings in the Problems panel |
| `bpmnkit.lint.run` | `onType` | `onType` or `onSave` |
| `bpmnkit.lint.forceEngineRules` | `false` | Apply Camunda 8 rules to an engine-neutral diagram |
| `bpmnkit.viewer.grid` | `true` | Dot grid behind the diagram |
| `bpmnkit.viewer.minimap` | `true` | Minimap in the BPMN viewer |
| `bpmnkit.simulation.enabled` | `true` | Offer step-through simulation in the preview |
| `bpmnkit.editing.enabled` | `true` | Let the diagram editor change the file |

Findings are reported for `.bpmn` files that are open; a file the editor has not loaded is
not analysed, same as every other linter in VS Code. Set `bpmnkit.editing.enabled` to `false`
for the same editors with editing switched off, when a diagram should be openable with no
chance of changing it.

## Support

The extension is pre-1.0 and community-supported, developed in the open in the
[monorepo](https://github.com/bpmnkit/monorepo) alongside the packages it is built from.
Minor versions may change behaviour before 1.0: the features above will not disappear, but
setting names and command titles may still move. Bugs and requests go to
[GitHub issues](https://github.com/bpmnkit/monorepo/issues). MIT-licensed, like everything
else in the repository.
