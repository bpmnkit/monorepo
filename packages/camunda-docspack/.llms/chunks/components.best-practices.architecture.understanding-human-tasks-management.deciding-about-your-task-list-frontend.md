# Understanding human task management — Deciding about your task list frontend

If you are orchestrating human tasks in your process, you must make up your mind on how exactly you want to let your users work on their tasks and interact with the workflow engine. You have basically three options:

- [Camunda Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist): The Tasklist application shipped with Camunda. This works out-of-the-box and has a low development effort. However, it is limited in terms of customizability and how much you can influence the user experience.

- Custom task list application: You can develop a custom task list and adapt this to your needs without compromises. User tasks are shown inside your custom application, following your style guide and usability concept. You will use the [Orchestration Cluster REST API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview) in the background. This is very flexible, but requires additional development work.

- Third party tasklist: If our organization already has a task list application rolled out to the field, you might want to use this for tasks created by Camunda. You will need to develop some synchronization mechanism. The upside of this approach is that your end users might not even notice that you introduce a new workflow engine.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/understanding-human-tasks-management
