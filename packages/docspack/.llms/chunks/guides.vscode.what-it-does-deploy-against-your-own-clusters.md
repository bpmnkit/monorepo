# VS Code Extension — What it does — Deploy against your own clusters

Deployment targets come from `casen`'s profile store — the same file
[`casen profile create`](/docs/cli/casen#connection-profiles) writes — so there is no second
place to configure a cluster and no credentials in your workspace settings:

```sh
casen profile create staging --base-url https://<cluster>.camunda.io/<id> \
  --auth-type oauth --client-id … --client-secret …
```

Every `c8` profile then appears in the extension. Deploy the open file, or deploy and start
an instance with variables; the instance key comes back in a notification. Deploy-and-start
also offers the payloads it finds in `.camunda/payloads/*.json`, walking up from the diagram,
so the inputs a process is always tried with are a pick rather than a paste.

Credentials are read only to sign the request — nothing in the extension stores, displays or
logs them.

---
Source: https://bpmnkit.com/docs/guides/vscode
