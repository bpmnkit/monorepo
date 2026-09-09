# BPMN Kit for VS Code

View, compare and analyse BPMN, DMN and Camunda Form files without leaving the editor —
and without a round trip through a modeler that rewrites your XML.

The renderer is [`@bpmnkit/canvas`](https://bpmnkit.com), a from-scratch BPMN 2.0
implementation. There is no bpmn.io anywhere in this extension, which is the point: the
files it shows you are the files git has, byte for byte.

## What it does

**Preview a diagram beside its source.** `.bpmn`, `.dmn` and `.form` all render, with a
minimap and zoom for BPMN. The preview follows the buffer as you type, not just on save,
and when the XML is momentarily unparseable it keeps the last drawing that worked rather
than blanking.

**Compare two diagrams visually.** Right-click a `.bpmn` file in Source Control to see it
against `HEAD`, or select exactly two in the Explorer and compare them with each other.
Added, removed, changed and moved elements are marked on synchronised canvases — a moved
element reads as *moved*, not as two unrelated pictures. The text diff stays exactly where
it was; this is a second view of the same change, not a replacement for the first.

**See analysis findings in the Problems panel.** The same static analysis `casen lint`
runs — flow reachability, naming, FEEL syntax, data flow, Camunda 8 deployability —
reported against the element that caused them, so clicking a problem takes you to the tag
rather than to line 1.

The analysis matches the file. A diagram that declares no `modeler:executionPlatform` is
not judged against Camunda 8 deployability, because "this service task has no
`zeebe:taskDefinition`" is not a defect in a diagram that was never going to be deployed
to Zeebe. Turn `bpmnkit.lint.forceEngineRules` on to apply those rules anyway.

## And four things nothing else in the Marketplace does

**Run the diagram, in the editor.** `@bpmnkit/engine` is a BPMN engine written in
TypeScript, so the preview does not need a cluster to execute what is on screen. Press Run
and watch tokens move; press One Step and advance the instance one element at a time,
reading the variables as they change. Nothing is deployed and nothing leaves your machine.

**A FEEL playground on your selection.** Select an expression anywhere in the XML and open
the playground: it comes up pre-filled, with a context you can edit and the result
evaluated as you type. Unary tests too, for decision-table input entries.

**Deploy and start against your own clusters.** The connections are the ones `casen`
already has — the extension reads the same profile store the CLI writes, so there is no
second place to configure a cluster and no credentials in your workspace settings. Deploy
the open file, or deploy and start an instance with variables, and the instance key comes
back in a notification.

**Copy the diagram as text.** For a code review, where a picture cannot go. The layout is
rendered into a fenced block that pastes into a pull request, an issue or a commit
message, dedented so the diagram is not mostly margin.

## It is read-only, deliberately

The diagram is a view; the XML is the document. Editing through a webview means taking on
VS Code's custom-document protocol — dirty state, hot exit, external edits, and a text
editor open on the same file that can disagree with you — and that is its own piece of
work rather than a checkbox on this one. Until it lands, the preview opens *beside* the
text editor instead of replacing it, and the text editor stays the default for every file
type here.

## Commands

| Command | Where |
|---|---|
| **BPMN Kit: Open Preview to the Side** | Editor title bar, command palette |
| **BPMN Kit: Compare Diagram with HEAD** | Source Control context menu, editor title bar |
| **BPMN Kit: Compare Diagrams Visually** | Explorer, with exactly two `.bpmn` files selected |
| **BPMN Kit: Open FEEL Playground** | Command palette — pre-filled from the selection |
| **BPMN Kit: Copy Diagram as ASCII** | Editor title bar, Explorer, command palette |
| **BPMN Kit: Deploy to Camunda 8** | Command palette |
| **BPMN Kit: Deploy and Start Instance** | Explorer, command palette |

"Reopen Editor With… → BPMN Kit Diagram" works too, and `workbench.editorAssociations`
will make it the default for `*.bpmn` if that is what you want.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `bpmnkit.lint.enabled` | `true` | Report findings in the Problems panel |
| `bpmnkit.lint.run` | `onType` | `onType` or `onSave` |
| `bpmnkit.lint.forceEngineRules` | `false` | Apply Camunda 8 rules to an engine-neutral diagram |
| `bpmnkit.viewer.grid` | `true` | Dot grid behind the diagram |
| `bpmnkit.viewer.minimap` | `true` | Minimap in the BPMN viewer |
| `bpmnkit.simulation.enabled` | `true` | Offer step-through simulation in the preview |

Findings are reported for `.bpmn` files that are open. A file the editor has not loaded is
not analysed — same as every other linter in VS Code.

## Camunda 8 profiles

Deployment targets come from `casen`'s profile store, not from VS Code settings — the same
file `casen profile create` writes. Create one with:

```sh
casen profile create staging --base-url https://<cluster>.camunda.io/<id> \
  --auth-type oauth --client-id … --client-secret …
```

Every `c8` profile then appears in the extension. When you have more than one, deploying
asks which; the active profile leads the list. Credentials are read only to sign the
request — nothing in the extension stores, displays or logs them.

## Support

This extension is **pre-1.0 and community-supported**. It is developed in the open in the
[bpmnkit monorepo](https://github.com/bpmnkit/monorepo) alongside the packages it is built
from, and it ships when they do.

- Bugs and requests: <https://github.com/bpmnkit/monorepo/issues>
- No response-time commitment, and no support contract is implied.
- Minor versions may change behaviour before 1.0. The features above will not disappear;
  settings names and command titles may still move.

Licensed MIT, like everything else in the repository.
