# Projects — Projects in Desktop Modeler

In Desktop Modeler, storing process resource files in a project is optional:

```
Desktop Modeler
├─ BPMN
├─ DMN
└─ Project B
    ├─ camunda-project.json
    ├─ BPMN
    ├─ Folder
    └─ Form
```

A project is recognized by the existence of a `camunda-project.json` file. If you're using both [Camunda Hub and Desktop Modeler](https://docs.camunda.io/docs/next/components/modeler/using-web-and-desktop-modeler-together), your project must contain this manifest file, even though it's ignored by Camunda Hub.

Unlike in Camunda Hub, all project resources are always deployed together in Desktop Modeler.


## Next steps

Read more about how to use projects in Desktop Modeler:

- [Projects in Camunda Hub](https://docs.camunda.io/docs/next/components/hub/workspace/manage-projects/manage-projects)
- [Projects in Desktop Modeler](https://docs.camunda.io/docs/next/components/modeler/desktop-modeler/process-applications)

---
Source: https://docs.camunda.io/docs/next/components/concepts/projects
