# casen Plugin Authoring

casen plugins are ordinary npm packages that export a `CasenPlugin` object. Once installed, their
commands appear in the main TUI and in shell tab-completion alongside the built-in ones.


## Scaffold a new plugin

The fastest way to start is with the official scaffolding tool:

```sh
pnpm create @bpmnkit/casen-plugin
# or: npx @bpmnkit/create-casen-plugin
# or: bunx @bpmnkit/create-casen-plugin
```

The tool runs interactively:

```
  @bpmnkit/create-casen-plugin — casen plugin scaffolding

  Plugin name (npm package name): casen-deploy
  Display name             (Deploy):
  Description              (): Git-tag-aware deploys for casen
  Author                   (): acme

  Initialize git repo? (Y/n): Y

  ✓ package.json
  ✓ tsconfig.json
  ✓ src/index.ts
  ✓ .gitignore
  ✓ git init

  Done! Created casen-deploy at ./casen-deploy
```

### Non-interactive mode

Pass flags to skip all prompts — useful in CI or cookiecutter scripts:

```sh
pnpm create @bpmnkit/casen-plugin \
  --name casen-deploy \
  --description "Git-tag-aware deploys for casen" \
  --author acme \
  --no-git
```

| Flag | Description |
|---|---|
| `--name` / `-n` | npm package name (first positional arg also works) |
| `--display-name` | Human-readable name shown in `casen plugin list` |
| `--description` / `-d` | One-line description |
| `--author` / `-a` | Author name or npm username |
| `--no-git` | Skip `git init` |

---
Source: https://docs.bpmnkit.com/cli/plugin-authoring/
