# Projects — Process applications in Desktop Modeler

The equivalent of a Camunda Hub project in Desktop Modeler is a process application. Storing process resource files in a process application is optional:

```
Desktop Modeler
├─ BPMN
├─ DMN
└─ Process Application
    ├─ .process-application
    ├─ BPMN
    ├─ Folder
    └─ Form
```

A process application is recognized by the existence of a `.process-application` file. If you're using both [Camunda Hub and Desktop Modeler](https://docs.camunda.io/docs/next/components/modeler/using-hub-and-desktop-modeler-together), your process application must contain this manifest file, even though it's ignored by Camunda Hub.

Unlike in Camunda Hub, all process application resources are always deployed together in Desktop Modeler.

---
Source: https://docs.camunda.io/docs/next/components/concepts/projects
