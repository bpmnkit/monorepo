# Orchestration Cluster REST API — API reference — Naming conventions

Naming across the Orchestration Cluster REST API is simple, intuitive, and consistent to reduce friction when working with multiple endpoints.

The conventions include:

- **Nouns over verbs** – e.g., `assignment` instead of `assign`
- **Plural terms** for top-level resources – e.g., `user-tasks`
- **Kebab-case** for multiple words in path parameters – e.g., `user-tasks`
- **camelCase** for multiple words in query parameters – e.g., `userTaskKey`

These conventions are illustrated in the following endpoint example:

`POST /user-tasks/{userTaskKey}/assignment`

For IDs or similar short 2- or 3-letter words or acronyms, Camunda only capitalizes the first letter. If standalone, all letters are lowercase.

| Term | Usage                                      |
| ---- | ------------------------------------------ |
| ID   | `id` (standalone) or `processDefinitionId` |
| URL  | `url` (standalone) or `externalUrl`        |
| UUID | `uuid` (standalone) or `clusterUuid`       |

Identifiers follow a naming convention for parameters and data attributes alike:

- Unique technical identifiers are suffixed with **key**, for example, `userTaskKey`, `processInstanceKey`, or `userKey`. These are usually numeric values.
- Other identifiers, such as those copied from the BPMN XML, are typically suffixed with **id**, for example, `processDefinitionId`.
- Key and id fields contain the entity as a prefix, for example, `userTaskKey` or `processDefinitionId`. This applies when referencing other resources like `formKey` in the user task entity and the respective entities themselves like `userTaskKey` in the user task entity.
- The full entity name is used as the prefix to avoid confusion, for example, `processDefinitionKey` instead of `processKey`, which could be interpreted as a process instance or process definition.
- Other entity attributes do not have a prefix to avoid clutter, such as `version` in the process definition entity. However, references to other resources require a prefix, like `processDefinitionVersion` in the process instance entity.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview
