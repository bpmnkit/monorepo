# VS Code Extension — What it does — Editing that leaves a readable diff

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

---
Source: https://bpmnkit.com/docs/guides/vscode
