---
"@bpmnkit/proxy": minor
"@bpmnkit/cli": minor
"@bpmnkit/desktop": patch
---

**Security: the local proxy is no longer open to every web page and every machine on the network.** This changes default behaviour.

Until now the proxy listened on all interfaces, answered every request with `Access-Control-Allow-Origin: *`, and let its `/fs/*` routes read, write, move and delete any absolute path. While it ran, any web page you visited, and any host on your network, could read or overwrite local files, use your Camunda profiles through `/api/*`, read secrets through `/secrets/*`, and start AI CLIs through `/chat`.

- **Loopback only.** The proxy listens on `127.0.0.1` and `::1`. `casen proxy start --host <addr>` or `BPMNKIT_PROXY_HOST` listens elsewhere and prints a warning.
- **Allowed origins only.** Browser requests must come from `https://bpmnkit.com`, `https://studio.bpmnkit.com`, `https://bpmnkit-studio.pages.dev`, the desktop app (`tauri://localhost`, `http(s)://tauri.localhost`) or a `localhost` / `127.0.0.1` / `[::1]` origin on any port. Other origins get `403` with no CORS headers, and the allowed origin is reflected with `Vary: Origin` instead of `*`. Cross-site browser requests without an `Origin` are refused too. Add origins with `--allow-origin` or `BPMNKIT_PROXY_ALLOWED_ORIGINS`.
- **Loopback `Host` only**, against DNS rebinding. Add names with `--allow-host` or `BPMNKIT_PROXY_ALLOWED_HOSTS`.
- **Workspace roots.** `/fs/*` and `/element-templates` work only inside folders passed with `--root` / `BPMNKIT_PROXY_ROOTS` or opened by Studio. The proxy refuses to open the filesystem root, your home directory, a folder that contains it, or a hidden folder unless you pass it with `--root`. Inside a root, only `.bpmn`, `.dmn`, `.form` and `.md` files and their metadata can be touched; `..` and symlinks out of the root are refused. The `/fs/*` routes accept an optional `root` (query or body) naming the workspace the path belongs to.
- `@bpmnkit/proxy` exports `createProxyServer`, `listenProxy` and the `ProxyServerOptions` type; `startServer(port, options)` takes the same options.
- The desktop app's bundled AI server (`proxy-rs`) applies the same bind, `Host` and origin rules.

Programs that send no `Origin` header (the CLI, the MCP server, `curl`) work as before. First-party clients need no change; Studio now names its project root on every file call so saves keep working after the proxy restarts.

Why a minor for `@bpmnkit/cli` at 1.x: the command line is unchanged apart from four new optional flags. What changes is what the proxy lets in, and the only callers it now turns away are ones that were never meant to reach it — any web page and any host on the network. A web app on your own origin needs `--allow-origin`; a proxy you reach over the network needs `--host` and `--allow-host`. Closing a hole that let any site read your files does not wait for a major.
