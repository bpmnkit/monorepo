# Outbound connectors vs. job workers — Focus

A job worker is often a complete Zeebe client application, dealing with environment tasks like handling variables in and out. The core logic of calling a defined URL is only part of the application.
Plus, it handles Camunda 8-specific APIs like the job worker API to handle variables, complete executions, and throw errors.

A connector only consists of core business functionality. No environment tasks, no Camunda 8 job worker-related code. You can run this from Camunda 7 as well if you have a runtime that takes care of this.
The connector only needs input variables and access to secrets so they can be used in defined input attributes.

---
Source: https://docs.camunda.io/docs/next/components/concepts/outbound-connectors-job-workers
