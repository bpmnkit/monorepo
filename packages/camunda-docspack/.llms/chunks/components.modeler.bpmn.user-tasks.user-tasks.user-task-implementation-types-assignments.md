# User tasks — User task implementation types — Assignments

User tasks support specifying assignments, using the `zeebe:AssignmentDefinition` extension element.
You can use this to define which user the task can be assigned to. You can specify one or all of the following attributes simultaneously:

- `assignee`: Specifies the user assigned to the task. [Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist) will claim the task for this user.
- `candidateUsers`: Specifies the users that the task can be assigned to.
- `candidateGroups`: Specifies the groups of users that the task can be assigned to.

**Info**
Starting with Camunda 8.8, user task candidate groups should reference group IDs instead of group names. The Zeebe engine will attempt to resolve a candidate group value in the following way:

1. Confirm a group ID exists for the value.
2. If no ID is found, find a group name for the value, and resolve its ID.

This behavior can be disabled by setting the `ZEEBE_BROKER_EXPERIMENTAL_ENGINE_CACHES_CANDIDATEGROUPNAMERESOLUTION=false` configuration property, so user task candidate group values are not checked by the Zeebe engine. See [zeebe.broker.experimental.engine.caches](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/zeebe/configuration/broker#zeebebrokerexperimentalenginecaches) for all related configuration properties.

**Info**
Usernames and group IDs in the Orchestration Cluster are case-sensitive. When you set `assignee`, `candidateUsers`, or `candidateGroups`, always use the exact value from your identity provider or Identity user record, including case. For example, `abc@example.com` and `Abc@example.com` are treated as different users.

Candidate users and candidate groups are not used by current Tasklist releases for task visibility or assignment. Use [user task authorization](https://docs.camunda.io/docs/next/components/tasklist/user-task-authorization) and [authorization-based access control](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations) to control who can see and work on a task.

Typically, the assignee, candidate users, and candidate groups are defined as [static values](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (e.g. `some_username`, `some_username, another_username` and
`sales, operations`), but they can also be defined as
[expressions](https://docs.camunda.io/docs/next/components/concepts/expressions) (e.g. `= book.author` and `= remove(reviewers, book.author)` and `= reviewer_roles`). The expressions are evaluated on activating the user task and must result in a
`string` for the assignee and a `list of strings` for the candidate users and a `list of strings` for the candidate groups.

For [Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist) to claim the task for a known Tasklist user, the value of the `assignee` must be the user's **unique identifier**.
The unique identifier depends on the authentication method used to login to Tasklist:

- Camunda 8 (login with email, Google, GitHub): `email`
- Default Basic authentication (Elasticsearch): `username`
- IAM: `username`

These assignees are not related to user restrictions, which is related to the visibility of the task in Tasklist for Self-Managed.

**Note**
For example, say you log into Tasklist using Camunda 8 login with email using your email address `foo@bar.com`. Every time a user task activates with `assignee` set to value `foo@bar.com`, Tasklist automatically assigns it to you. You'll be able to find your new task under the task dropdown option `Assigned to me`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
