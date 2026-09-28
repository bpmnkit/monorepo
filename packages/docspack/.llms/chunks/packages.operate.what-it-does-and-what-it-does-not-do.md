# @bpmnkit/operate — What it does, and what it does not do

Compared with [Camunda Operate](https://docs.camunda.io/docs/components/operate/operate-introduction/):

| | `@bpmnkit/operate` | Camunda Operate |
|---|---|---|
| Dashboard counts (active instances, open incidents, active jobs, pending tasks, definitions) | Yes | Yes |
| Process definitions and versions, with the diagram | Yes | Yes |
| Decision definitions, with the DMN table | Yes | Yes |
| Process instance list, filter by state and root process | Yes, client side | Yes, server side |
| Instance diagram with active and completed elements | Yes | Yes |
| Instance variables (read) | Yes | Yes |
| Edit variables | No | Yes |
| Cancel one process instance | Yes | Yes |
| Start a process instance (with business ID and variables) | Yes | No |
| Incidents: retry job (sets retries to 3), resolve incident | Yes | Yes |
| Jobs list | Yes | No |
| User tasks list and form preview | Yes (read only) | No (Tasklist) |
| Publish / correlate a message, broadcast a signal | Yes | No |
| AI incident analysis and natural-language search | Yes, if the proxy has an AI CLI | No |
| Process instance modification and migration | No | Yes |
| Batch operations (cancel, resolve, migrate, modify, delete) | No | Yes |
| Decision instance history | No | Yes |
| Deleting instances | No | Yes |
| Large result sets | No: each list loads at most 1000 items | Yes |
| Users, roles, authorizations, multi-tenancy UI | No: whatever the proxy profile may do | Yes |
| Real-time push | No: the browser polls (30 s by default) | Periodic refresh |

Use it to look at what your process is doing while you build it. Use Camunda Operate
when you need history, bulk operations or access control.

---
Source: https://bpmnkit.com/docs/packages/operate
