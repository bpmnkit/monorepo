# @bpmnkit/editor — Basic Setup

```typescript
import { BpmnEditor, initEditorHud } from "@bpmnkit/editor";

// Create the editor
const editor = new BpmnEditor({
  container: document.getElementById("editor"),
  theme: "dark",
  persistTheme: true,   // read/write "bpmn-theme" in localStorage
});

// Initialize the HUD (toolbar overlay)
const hud = initEditorHud(editor);

// Load a diagram
await editor.loadXML(bpmnXml);
```


## With Side Dock

The side dock provides a collapsible properties + AI panel:

```typescript
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor";

const editor = new BpmnEditor({
  container: document.getElementById("editor"),
});

const dock = createSideDock();
document.body.appendChild(dock.el);

const hud = initEditorHud(editor, {
  aiButton: dock.aiPane.button,
});
```

---
Source: https://bpmnkit.com/docs/packages/editor
