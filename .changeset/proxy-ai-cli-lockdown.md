---
"@bpmnkit/proxy": minor
"@bpmnkit/cli": patch
"@bpmnkit/desktop": patch
---

**Security hardening: the AI CLIs the proxy starts can no longer run commands, touch files or open URLs.**

`/chat` started `claude` with `--dangerously-skip-permissions --permission-mode bypassPermissions`, so anything that reached the route — an XSS on an allowed origin, or a prompt injection carried in a BPMN file, chat text or a process variable — could have the CLI run shell commands on your machine. `copilot` ran with `--yolo`, and so did the desktop app's `gemini`. The diagram tool `compose_diagram` (and `sdk_search` / `sdk_execute`) ran the model's code under `node:vm`, which a Bridge function's `constructor` escapes to `process`.

- **No built-in tools, no bypass.** Every run — `/chat`, `/improve`, `/operate/chat`, `/operate/incident-assist`, `/operate/ai-search`, the `io.bpmnkit:llm:1` worker, `casen ask` — gets permission checks on and no shell, file or web tools. `claude` runs with `--tools "" --strict-mcp-config --setting-sources "" --permission-mode dontAsk`; `copilot` with `--deny-tool=shell --deny-tool=write --deny-tool=url` and no `--allow-all-tools`; `gemini` with a policy that denies every tool, `--extensions none`, and `--skip-trust` for the empty run folder.
- **Only the proxy's diagram tools for diagram edits.** A `/chat` edit may call the eight `bpmn` MCP tools and nothing else; none of your own MCP servers, settings, plugins or project instructions load. Each run starts in an empty temporary folder.
- **`compose_diagram`, `sdk_search` and `sdk_execute` run in an `isolated-vm` isolate** that sees only copies of what the Bridge returns.
- **Request data is fenced.** Chat text, diagrams, incident details and variable values reach the model inside `<untrusted-input>` tags the system prompt marks as data. `claude` gets the conversation on stdin and `--system-prompt` in place of its coding-agent prompt.
- `@bpmnkit/proxy` exports `askText(cli, systemPrompt, userText)` for a one-off tool-less answer; `casen ask` now uses it.
- The desktop app's AI server (`proxy-rs`) applies the same flags, fencing and empty working folder, and no longer passes `--yolo` to `gemini`.

Features are unchanged: the AI panel still edits diagrams through the MCP tools, and `/improve`, incident assist and AI search still answer with text or JSON. A developer who set up Bedrock or Vertex for `claude` through `~/.claude/settings.json` `env` needs those variables in the proxy's environment instead, since user settings are no longer loaded.
