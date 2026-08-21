# @bpmnkit/editor — Full Editor with All Plugins

The landing page editor uses the `createStorageTabsBridge` plugin which wires together
tabs, storage, AI, and command palette in one call:

```typescript
import { createStorageTabsBridge } from "@bpmnkit/canvas-plugin-storage-tabs-bridge";
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor";

const editor = new BpmnEditor({ container });
const dock = createSideDock();

const bridge = createStorageTabsBridge({
  mainMenu: menuPlugin,
  resolver: fileResolver,
  enableFileImport: true,
  getExamples: (tabsApi) => [
    {
      label: "Approval Flow",
      load: () => tabsApi.openTab({ xml: approvalFlowXml }),
    },
  ],
});

document.body.appendChild(dock.el);
const hud = initEditorHud(editor, { aiButton: dock.aiPane.button });
```

---
Source: https://docs.bpmnkit.com/packages/editor/
