# casen connector — Browse the bundled OOTB catalog

```sh
casen connector search slack
casen connector show io.camunda.connectors.Slack.v1
```

`search` scores the 116 bundled templates by keyword match and prints a table (template id,
direction, task type, description). `show` prints a template's task type, direction, and its
required/optional input keys — these are the keys a `ProcessPlan` `connector` step's `values`
object uses (see [Building Processes with AI](/docs/guides/ai-implement)):

```
$ casen connector show io.camunda.connectors.Slack.v1
Slack connector  (io.camunda.connectors.Slack.v1)
Task type: io.camunda:slack:1
Direction: outbound
Create a channel or send a message to a channel or user

Required inputs:
  token (secret) — OAuth token
  data.channel — Channel/user name/email
  data.text — Message
  ...
```

A field marked `(secret)` should be supplied as a `{{secrets.NAME}}` placeholder, never a literal
credential. This is the same catalog `@bpmnkit/connectors`' `listConnectors()`/`searchConnectors()`
expose programmatically.

---
Source: https://bpmnkit.com/docs/cli/connector
