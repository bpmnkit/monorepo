# Variables — Variable size limitation

The payload of a process instance is limited to 4 MB. This limit includes both process variables and workflow engine–internal data, so less than 4 MB is available for variables alone.

The effective limit depends on the operation. As a rule of thumb, ~1.5 MB is considered safe for commands or events that include variables, such as starting a process instance or completing a job. In these cases, the engine may append follow-up records that temporarily duplicate the variable payload within the same batch.

To avoid production issues, leave headroom below the limit—for example, target ≤1 MB—and validate with a production-like test case. If the payload size is uncertain, run a quick test to confirm behavior.

**Note**
Regardless, we don't recommend storing much data in your process context. Refer to our [best practice on handling data in processes](https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes).

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
