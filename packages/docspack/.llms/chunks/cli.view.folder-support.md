# casen view — Folder support

Pass a directory instead of individual files. The viewer scans the top level of the directory
for files with the matching extension and gives each one its own tab.

```sh
# All .bpmn files in ./processes/
casen view bpmn ./processes/

# All supported types in ./project/
casen view open ./project/
```


## Flags

All subcommands accept the same flags:

| Flag | Description | Default |
|---|---|---|
| `--port` | Port for the local server | `3044` |
| `--theme` | Color theme: `light` or `dark` | `light` |
| `--no-open` | Do not open the browser automatically | `false` |

```sh
# Dark theme on a custom port without auto-opening
casen view bpmn process.bpmn --theme dark --port 8080 --no-open
```

---
Source: https://bpmnkit.com/docs/cli/view
