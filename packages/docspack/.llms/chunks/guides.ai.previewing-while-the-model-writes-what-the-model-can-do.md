# AI Integration — Previewing While the Model Writes — What the model can do

The proxy runs your installed `claude`, `copilot` or `gemini` CLI for the AI panel, but not as
a coding agent. The model gets no shell, no file access and no web access, and none of your
own MCP servers, settings or plugins. What it can do depends on the request:

| Request | The model gets |
|---|---|
| AI panel chat, improve, explain (`/chat`) | The diagram tools of the proxy's MCP server, which change only the diagram held in that server's memory. The result comes back as the `xml` event; nothing is written to your project. |
| Create form or decision (`/chat`), improve with operations (`/improve`, `casen lint --ai`), Operate chat, incident assist, AI search, `casen ask` | No tools. The model answers with text or JSON, and the proxy does the rest. |

Everything that comes from the request — your chat text, the diagram, an incident's variables —
reaches the model inside `<untrusted-input>` tags, and the system prompt tells it to treat that
as data. A diagram that says "ignore your instructions" is still just a diagram.

---
Source: https://bpmnkit.com/docs/guides/ai
