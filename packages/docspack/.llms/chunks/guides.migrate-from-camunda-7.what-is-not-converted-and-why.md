# Migrate from Camunda 7 — What is not converted, and why

- **Java delegates, listeners and scripts.** Camunda 8 runs no user code in the engine. Every
  delegate becomes a job worker. The converter chooses the job type and keeps the original
  class or expression as a task header, so that one generic worker can dispatch on it while
  you port the code. Execution and task listeners become job-worker listeners in Camunda 8
  (`zeebe:executionListeners`, `zeebe:taskListeners`). The converter names the matching event
  type, but it does not write the listener. Groovy and JavaScript scripts must be rewritten
  as FEEL or as a worker.
- **Message correlation.** Camunda 7 correlates a message by an API call (business key,
  variables or instance id). The model does not name a key. Camunda 8 requires a
  `correlationKey` for every message catch, and only you know which variable it is.
- **Asynchronous continuations.** Camunda 8 has none. The engine commits after every step,
  and every job-based task is already a wait state, so there is no transaction boundary to
  place. A failure does not roll back to the last async boundary. A job failure retries the
  job, and an expression failure raises an incident on the element.
- **Retry intervals.** The retry count goes to the task definition. The back-off is not part
  of the Camunda 8 model: the worker gives it when it fails the job. A zero interval needs
  nothing.
- **Decision result mappers.** Camunda 8 stores the decision's own result: a value for one
  output, a context for several outputs, and a list for collect hit policies. This matches
  Camunda 7's `singleEntry`. For other mappers, check what downstream elements read.
- **No equivalent (unsupported):** `camunda:historyTimeToLive` (retention is configured for
  the cluster), `candidateStarterGroups` / `candidateStarterUsers` (use authorizations),
  `camunda:initiator`, `take` listeners on sequence flows, `timeout` task listeners, retry
  cycles on elements that have no job, standard loops, CMMN case calls, tenant ids on calls
  and decisions.
- **Anything else with the `camunda:` prefix** is reported as `manual` and kept. The report
  never omits a construct.

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
