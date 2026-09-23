# VS Code Extension — Installing

Search for **BPMN Kit** (`bpmnkit.bpmnkit`) in the Extensions view — it is published to the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=bpmnkit.bpmnkit)
and to [Open VSX](https://open-vsx.org/extension/bpmnkit/bpmnkit) for VSCodium, Cursor and
other Open VSX editors — or from a terminal:

```sh
code --install-extension bpmnkit.bpmnkit
```

Every version is also attached as a `.vsix` to a
[GitHub Release](https://github.com/bpmnkit/monorepo/releases?q=vscode-v) tagged
`vscode-v<version>`, for machines that cannot reach a registry. Install it with
**Extensions → … → Install from VSIX…**, or `code --install-extension bpmnkit-<version>.vsix`.

To build it yourself from the monorepo:

```sh
git clone https://github.com/bpmnkit/monorepo
cd monorepo && pnpm install
pnpm turbo build --filter bpmnkit...
pnpm --filter bpmnkit package     # → apps/vscode/bpmnkit.vsix
```

It activates on a workspace containing a `.bpmn` file, and requires VS Code 1.90 or newer.

---
Source: https://bpmnkit.com/docs/guides/vscode
