# Multi-instance — Additional resources

### XML representation

A sequential multi-instance service task:

```xml
<bpmn:serviceTask id="task-A" name="A">
  <bpmn:multiInstanceLoopCharacteristics isSequential="true">
    <bpmn:extensionElements>
      <zeebe:loopCharacteristics
          inputCollection="= items" inputElement="item"
          outputCollection="results" outputElement="= result" />
    </bpmn:extensionElements>
    <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">
        = result.isSuccessful
    </bpmn:completionCondition>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:serviceTask>
```

### References

- [Variable scopes](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes)
- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
