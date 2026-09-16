# Compensation — Variable mappings

A compensation handler can define input and output [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings).

Input variable mappings are applied before invoking the compensation handler. They can be used to create local variables
for the compensation handler.

Output variable mappings are applied after completing the compensation handler. They can be used to customize how the
result variables of the compensation handler are merged into the process instance. By default, all variables are merged.


## Additional resources

### XML representation

A service task with a compensation marker:

```xml
<bpmn:serviceTask id="undo-A" name="undo A" isForCompensation="true">
    <bpmn:extensionElements>
        <zeebe:taskDefinition type="undo-A" />
    </bpmn:extensionElements>
</bpmn:serviceTask>
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler
