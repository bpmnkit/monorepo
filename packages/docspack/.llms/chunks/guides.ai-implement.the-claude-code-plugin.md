# Building Processes with AI — The Claude Code plugin

The richest way to drive this pipeline is the `bpmnkit` Claude Code plugin:

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

It's **CLI-first**: every skill drives `casen` via Bash — no MCP server, no proxy daemon. Each skill reads the relevant generated/hand-written reference doc (plan format, connector catalog, agentic pattern, FEEL syntax, modeling conventions) before authoring a plan.

```
/bpmnkit:implement an invoice approval process for accounts payable
```

Claude works through: resolve connectors → write the plan → compile → test → scaffold missing workers → present a summary → ask where to deploy.

Related skills: `/bpmnkit:extend <file> <change>` (lift an existing process to a plan, apply a targeted delta, merge), `/bpmnkit:agent` (design an AI Agent Sub-process — see [AI Agents](/guides/ai-agents/)), `/bpmnkit:connect <file> <step> <service>` (wire an existing step to a connector), `/bpmnkit:review`, `/bpmnkit:test`, `/bpmnkit:deploy`.

---
Source: https://docs.bpmnkit.com/guides/ai-implement/
