# Embedded subprocess — Collapsed subprocesses

**Caution**
Collapsed subprocesses are currently only partially supported by Optimize. While diagrams containing collapsed subprocesses can be imported, it is not possible to drill down into the subprocesses.

All other Camunda components fully support collapsed subprocesses.

A collapsed subprocess conceals its internal details, thereby hiding complexity within an activity and enabling the nesting of multiple levels of subprocesses. This functionality allows you to simplify the view of a process diagram and facilitates drill-down capabilities to examine details.

Collapsed subprocesses serve purely display purposes. For the creation of reusable processes, it is recommended to utilize [call activities](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities).

**Info**
When you add a **collapsed subprocess**, Modeler shows a link for drill-down. This link only opens the embedded subprocess within the same diagram. You can’t target or reuse a different process from that link. To reference another process you’ve already created, use a [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities) instead.

![collapsed-subprocess](assets/collapsed-subprocess.png)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses
