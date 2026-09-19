# Ad-hoc sub-processes — XML representation

An ad-hoc sub-process is represented in BPMN XML using the `adHocSubProcess` element. The following example configures the active elements collection via the Zeebe `adHoc` extension and defines a completion condition.

```xml
<bpmn:adHocSubProcess id="ad-hoc-subprocess" name="Ad-hoc sub-process" cancelRemainingInstances="false">
  <bpmn:extensionElements>
    <zeebe:adHoc activeElementsCollection="=activeElements" />
  </bpmn:extensionElements>
  ... more contained elements ...
  <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">=myCondition</bpmn:completionCondition>
</bpmn:adHocSubProcess>
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses
