# VS Code Extension — Installing

The extension is **pre-1.0 and not on the Marketplace yet** — it is built from the monorepo
and ships when the packages it is built from do:

```sh
git clone https://github.com/bpmnkit/monorepo
cd monorepo && pnpm install
pnpm --filter bpmnkit build
pnpm --filter bpmnkit package     # → apps/vscode/bpmnkit.vsix
```

Then install the `.vsix`: **Extensions → … → Install from VSIX…**, or

```sh
code --install-extension apps/vscode/bpmnkit.vsix
```

It activates on a workspace containing a `.bpmn` file, and requires VS Code 1.90 or newer.

---
Source: https://bpmnkit.com/docs/guides/vscode
