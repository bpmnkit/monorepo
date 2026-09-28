# casen CLI — Local proxy

`casen proxy start` (or `casen proxy`) starts the local proxy on port 3033. Studio, the
bpmnkit.com editor and Operate page, and the desktop app use it for AI, deploys, Camunda API
calls with your stored profiles, and Studio's project folders.

```sh
casen proxy start
```

| Flag | Default | Description |
|---|---|---|
| `--port <n>` | `3033` | Port to listen on. |
| `--host <addr>` | loopback | Interface to listen on. By default the proxy listens on `127.0.0.1` and `::1` only. Any other value exposes it to the network and prints a warning. |
| `--allow-origin <list>` | — | Extra browser origins that may call the proxy, comma-separated. |
| `--allow-host <list>` | — | Extra `Host` names the proxy answers to, comma-separated. You need this with `--host 0.0.0.0`. |
| `--root <list>` | — | Folders the file routes may always use, separated like `PATH` (`:` on macOS and Linux, `;` on Windows). |

The same settings are read from `BPMNKIT_PROXY_HOST`, `BPMNKIT_PROXY_ALLOWED_ORIGINS`,
`BPMNKIT_PROXY_ALLOWED_HOSTS` and `BPMNKIT_PROXY_ROOTS`, for example when you run the
`bpmn-ai-server` binary directly. Flags add to the lists from the environment.

---
Source: https://bpmnkit.com/docs/cli/casen
