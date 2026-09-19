# Versioning process definitions — Dealing with long running processes

In general, _do not be concerned with deploying long-running processes_ which might run days, weeks or even months. After all, this is exactly what Camunda was built to properly deal with.

Having said that, also review the possibilities the workflow engine provides with respect to _cutting process definitions_ (e.g. via _message exchange_ or via _call activities_) and _migrating running process instances_. But even though it's possible to migrate running process instances to a new version (refer below), it's typically a bit of _effort_. Therefore, the information presented in the following sections is meant to enable your conscious decision at which points it might make sense for you to avoid the necessity for migration by cutting processes and which aspects of versioning behavior you can control by doing that.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
