# AI Agents — The `aiAgent` plan step

```json
{
  "kind": "aiAgent",
  "id": "triage_agent",
  "name": "Triage agent",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "providerInputs": {
    "provider.anthropic.authentication.apiKey": "{{secrets.ANTHROPIC_API_KEY}}"
  },
  "systemPrompt": "You triage support tickets and post updates to Slack.",
  "userPrompt": "=ticketText",
  "tools": [
    {
      "id": "notify_slack",
      "description": "Post a status update to the #support-escalations Slack channel.",
      "connector": {
        "template": "io.camunda.connectors.Slack.v1",
        "values": {
          "method": "chat.postMessage",
          "token": "{{secrets.SLACK_OAUTH_TOKEN}}",
          "data.channel": "#support-escalations",
          "data.text": "placeholder"
        }
      },
      "params": [
        { "name": "message", "description": "The status update to post", "type": "string", "target": "data.text" }
      ]
    },
    {
      "id": "escalate",
      "description": "Escalate the ticket to a human agent.",
      "jobType": "escalate:1",
      "params": [{ "name": "reason", "description": "Why this needs a human" }]
    }
  ],
  "errorBoundary": {
    "errorCode": "AGENT_FAILED",
    "steps": [{ "kind": "end", "id": "agent_failed", "errorCode": "AGENT_FAILED" }]
  }
}
```

Compile it like any other plan:

```sh
casen synth support-triage.plan.json --output support-triage.bpmn
casen lint lint support-triage.bpmn --profile deploy
```

Key points:

- **Every tool needs an `id` and a `description`** written for the LLM to read, like briefing a teammate.
- **A tool is either connector-backed (`connector`) or a plain job-worker (`jobType`)** — never both. Search the connector catalog first (`casen connector search`), fall back to `jobType` (with a scaffolded worker) only when no connector exists.
- **A `params[].target` matching a connector value's key overrides it** — the standard way to let the LLM control one field of an otherwise-fixed connector call, as in `notify_slack` above: the channel is fixed, but the message text is supplied by the agent at call time. Give the overridden key a placeholder value in `connector.values`, not a real one.
- **Always give the agent step an error boundary** — an unhandled agent/tool failure needs somewhere to go.
- **Secrets always use `{{secrets.NAME}}`** — never a literal API key or token.

---
Source: https://docs.bpmnkit.com/guides/ai-agents/
