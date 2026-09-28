# VS Code Extension — Installing

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

---
Source: https://bpmnkit.com/docs/guides/vscode
