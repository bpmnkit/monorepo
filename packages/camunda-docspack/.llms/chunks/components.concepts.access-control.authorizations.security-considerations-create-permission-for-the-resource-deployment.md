# Orchestration Cluster authorization — Security considerations — `CREATE` permission for the Resource (deployment)

Granting `CREATE` permission on the **Resource** is equivalent to allowing remote code execution. When a user deploys a BPMN model, it can contain executable code in script tasks, service tasks, or listeners that will be run by the process engine.

Only grant this permission to users and clients who are fully trusted to deploy and execute code in your environment.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
