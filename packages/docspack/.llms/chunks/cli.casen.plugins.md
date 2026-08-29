# casen CLI — Plugins

casen's plugin system lets you extend the CLI with new command groups — your own organisation's
workflows, third-party integrations, or community-built tools.

### Discover plugins

```sh
# Browse all published casen plugins
casen plugin search

# Search by keyword
casen plugin search deploy
casen plugin search slack
```

Results are fetched live from the npm registry. Any package tagged with the `casen-plugin` keyword
appears here.

### Install a plugin

```sh
# Install from npm
casen plugin install casen-deploy

# Install a local plugin during development
casen plugin install ./my-plugin
```

Plugins are installed into `~/.casen/plugins/` and loaded automatically the next time casen starts.

### Manage installed plugins

```sh
# List installed plugins
casen plugin list

# Show full details for one plugin
casen plugin info casen-deploy

# Update a single plugin to the latest version
casen plugin update casen-deploy

# Update all installed plugins
casen plugin update

# Remove a plugin
casen plugin remove casen-deploy
```

Once installed, plugin commands appear in the main TUI and in tab-completion alongside built-in commands.

To build your own plugin, see [Plugin Authoring](/docs/cli/plugin-authoring).

---
Source: https://bpmnkit.com/docs/cli/casen
