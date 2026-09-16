# Versioning process definitions

For real-life applications, it's crucial to understand how Camunda deals with evolving process definitions by means of versioning.

For real-life applications, it's crucial to understand how Camunda deals with evolving process definitions by means of versioning. As a rule of thumb, we recommend to version just the process and decision models, but not other process solution artifacts (like e.g. code classes or scripts). Often you might not even want to run multiple model versions at the same time, then you have to think about migrate running process instances to new versions. When modeling very long-running processes (> 6 months), consider cutting them into reasonable pieces to ease managing your versioning requirements.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
