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

### Who can use the proxy

The proxy acts with your Camunda credentials and reads and writes files. Any web page open in
your browser can send requests to `localhost`, so the proxy checks every request:

- **Origin.** A browser request must come from `https://bpmnkit.com`,
  `https://studio.bpmnkit.com`, `https://bpmnkit-studio.pages.dev`, the desktop app
  (`tauri://localhost`, `http(s)://tauri.localhost`), any `localhost`, `127.0.0.1` or
  `[::1]` origin on any port, or an origin you allow with `--allow-origin`. Other origins get
  `403` and no CORS headers. Cross-site browser requests without an `Origin` header, such as
  an image tag, are also refused. Programs that send no `Origin` (the CLI, the MCP server,
  `curl`) are served.
- **Host.** A request must name the proxy as `localhost`, `127.0.0.1` or `[::1]`, or as a
  host you allow with `--allow-host`. This stops DNS-rebinding pages.
- **Files.** The `/fs/*` routes and `/element-templates` work only inside workspace roots:
  folders you pass with `--root`, and project folders Studio opens. The proxy does not open
  the filesystem root, your home directory, a folder that contains your home directory, or a
  hidden folder such as `~/.ssh` unless you pass it with `--root`. Inside a root, only
  `.bpmn`, `.dmn`, `.form` and `.md` files (and their `.bpmnkit` metadata) can be read,
  written, moved or deleted. Paths with `..`, and symlinks that lead out of the root, are
  refused.

To use the proxy from your own web app, allow its origin:

```sh
casen proxy start --allow-origin https://modeler.example.com
```

To reach the proxy from another machine, which gives that network your credentials and
files, listen on all interfaces and name the host clients use:

```sh
casen proxy start --host 0.0.0.0 --allow-host devbox.lan
```

---
Source: https://bpmnkit.com/docs/cli/casen
