# casen Plugin Authoring — Test locally

Build and install your plugin from the local directory:

```sh
cd casen-deploy
pnpm install
pnpm build

casen plugin install ./casen-deploy
```

Restart casen. Your commands appear under `casen deploy` (or whatever group name you chose).

To uninstall during development:

```sh
casen plugin remove casen-deploy
```


## Publish to npm

When you're ready to share:

```sh
cd casen-deploy
npm publish
```

The `prepublishOnly` script in the generated `package.json` runs `tsc` automatically before
publishing, so `dist/` is always up to date.

Because `"casen-plugin"` is in `keywords`, your package is immediately discoverable via:

```sh
casen plugin search deploy
```

---
Source: https://bpmnkit.com/docs/cli/plugin-authoring
