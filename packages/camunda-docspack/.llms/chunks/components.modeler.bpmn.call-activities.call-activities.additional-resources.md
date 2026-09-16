# Call activities — Additional resources

### XML representation

A call activity with static process id, propagation of all child variables turned on, and no explicit binding type (`latest` is used implicitly):

```xml
<bpmn:callActivity id="Call_Activity" name="Call Process A">
  <bpmn:extensionElements>
    <zeebe:calledElement processId="child-process-a" propagateAllChildVariables="true" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

A call activity with the `deployment` binding type:

```xml
<bpmn:callActivity id="Call_Activity" name="Call Process A">
  <bpmn:extensionElements>
    <zeebe:calledElement processId="child-process-a" bindingType="deployment" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

A call activity with the `versionTag` binding type:

```xml
<bpmn:callActivity id="Call_Activity" name="Call Process A">
  <bpmn:extensionElements>
    <zeebe:calledElement processId="child-process-a"
                         bindingType="versionTag" versionTag="v1.0" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

A call activity with copying of all variables to the child process turned off:

```xml
<bpmn:callActivity id="Call_Activity" name="Call Process A">
    <bpmn:extensionElements>
        <zeebe:calledElement processId="child-process-id" propagateAllParentVariables="false" />
        <zeebe:ioMapping>
            <zeebe:input source="=variableValue" target="variableName" />
        </zeebe:ioMapping>
    </bpmn:extensionElements>
</bpmn:callActivity>
```

### References

- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Variable scopes](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities
