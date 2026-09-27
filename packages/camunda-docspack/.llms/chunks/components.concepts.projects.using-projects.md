# Projects — Using projects

You can use projects in both Camunda Hub and Desktop Modeler. However, there are some differences.


## Projects in Camunda Hub

In Camunda Hub, workspaces contain projects, and projects contain files. Every file must be stored within a project:

```
Camunda Hub
└─ Workspace
    ├─ Project A
    │   ├─ BPMN
    │   └─ DMN
    └─ Project B
        ├─ BPMN
        ├─ Folder
        └─ Form
```

You can treat files in a project as a single bundle or as independent resources. For example, you can:

- [Take a snapshot](https://docs.camunda.io/docs/next/components/hub/workspace/manage-projects/project-versioning) of the current state of all project files.
- Manage individual [file versions](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/modeling/versions).
- [Deploy an entire project](https://docs.camunda.io/docs/next/components/hub/workspace/manage-projects/deploy-project).
- [Deploy individual project resources](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/run-or-publish-your-process#deploy-a-process).

---
Source: https://docs.camunda.io/docs/next/components/concepts/projects
