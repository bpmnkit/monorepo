# Standalone Workers — Camunda SaaS

For Camunda 8 cloud, pass OAuth2 credentials as environment variables:

```sh
ZEEBE_ADDRESS=https://your-cluster.bru-2.zeebe.camunda.io:443 \
ZEEBE_CLIENT_ID=... \
ZEEBE_CLIENT_SECRET=... \
npm run start:prod
```

`@bpmnkit/worker-client` handles OAuth2 token fetching and caching automatically.


## Listing available workers

```sh
casen worker start --help
```

Or from Claude Code, call `worker_list` to see all built-in and scaffolded workers:

```
worker_list()
```

Built-in workers (provided by the proxy):

| Job type | Description |
|---|---|
| `bpmnkit:llm:1` | Call an LLM and return the response text |
| `bpmnkit:cli:1` | Run a shell command |
| `bpmnkit:http:scrape:1` | Fetch and extract text from a URL |
| `bpmnkit:fs:read:1` | Read a file from the local filesystem |
| `bpmnkit:fs:write:1` | Write content to a file |
| `bpmnkit:fs:append:1` | Append content to a file |
| `bpmnkit:fs:list:1` | List files in a directory |
| `bpmnkit:js:1` | Evaluate a JavaScript expression |
| `bpmnkit:email:fetch:1` | Fetch email from an IMAP mailbox |
| `bpmnkit:email:send:1` | Send email via SMTP |

---
Source: https://bpmnkit.com/docs/guides/workers-standalone
