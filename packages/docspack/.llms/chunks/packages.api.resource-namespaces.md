# @bpmnkit/api — Resource Namespaces

All methods are grouped by resource type:

| Namespace | Methods |
|---|---|
| `client.process` | deploy, startInstance, listInstances, getInstance, cancel, migrate |
| `client.jobs` | activate, complete, fail, throwError, activateAndProcess |
| `client.incidents` | list, resolve, get |
| `client.variables` | list, get, update |
| `client.decisions` | evaluate, list, getInstance |
| `client.messages` | publish, correlate |
| `client.signals` | broadcast |
| `client.userTasks` | list, get, complete, assign, claim |
| `client.users` | list, get, create, delete |
| `client.groups` | list, get, create, assignMember |
| `client.authorizations` | list, create, delete |

---
Source: https://docs.bpmnkit.com/packages/api/
