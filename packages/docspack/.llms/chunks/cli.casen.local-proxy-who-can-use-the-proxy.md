# casen CLI — Local proxy — Who can use the proxy

The proxy acts with your Camunda credentials and reads and writes files. Any web page open in
your browser can send requests to `localhost`, so the proxy checks every request:

- **Origin.** A browser request must come from `https://bpmnkit.com`,
  `https://bpmnkit-studio.pages.dev`, the desktop app
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
- **AI CLIs.** The AI routes (`/chat`, `/improve`, `/operate/chat`,
  `/operate/incident-assist`, `/operate/ai-search`), the `io.bpmnkit:llm:1` worker and
  `casen ask` start `claude`, `copilot` or `gemini` with permission checks on and no
  built-in tools: the model cannot run commands, read or write files, or open URLs. Each run
  starts in an empty temporary folder and loads none of your own MCP servers, settings,
  plugins or extensions. A `/chat` run that edits a diagram gets only the proxy's diagram
  tools (`get_diagram`, `compose_diagram`, `add_elements`, `remove_elements`,
  `update_element`, `set_condition`, `add_http_call`, `replace_diagram`); they change the
  diagram in the MCP server's memory, and `compose_diagram` runs the model's code in an
  isolated V8 isolate. Chat text, diagrams, incident details and variable values reach the
  model fenced as untrusted data.

| CLI | Flags the proxy passes |
|---|---|
| `claude` | `-p --system-prompt … --tools "" --strict-mcp-config --setting-sources "" --permission-mode dontAsk --disable-slash-commands --no-session-persistence`, plus `--mcp-config <run config> --allowedTools mcp__bpmn__…` for diagram edits. The conversation goes on stdin. |
| `copilot` | `-p … --deny-tool=shell --deny-tool=write --deny-tool=url --disable-builtin-mcps --no-custom-instructions --no-ask-user --disallow-temp-dir`, plus `--additional-mcp-config @<run config> --allow-tool=bpmn(<tool>)` per diagram tool. |
| `gemini` | `--prompt … --approval-mode default --admin-policy <deny-all> --policy <deny-all> --extensions none --skip-trust`, where the policy denies every tool and trust covers only the empty run folder. |

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
