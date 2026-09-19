# Receive tasks — Variable mappings

Output variable mappings are used to customize how variables are merged into the process instance.
These can contain multiple elements that specify which variables should be mapped.
The `Process Variable Name` of an output denotes the variable name outside the activity.

Visit our documentation on [input and output variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings) for more information on this topic.


## Additional resources

### XML representation

A receive task with message definition:

```xml
<bpmn:message id="Message_1iz5qtq" name="Money collected">
   <bpmn:extensionElements>
     <zeebe:subscription correlationKey="=orderId" />
   </bpmn:extensionElements>
</bpmn:message>

<bpmn:receiveTask id="money-collected" name="Money collected"
  messageRef="Message_1iz5qtq">
</bpmn:receiveTask>
```

### References

- [Message correlation](https://docs.camunda.io/docs/next/components/concepts/messages)
- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
- [Incidents](https://docs.camunda.io/docs/next/components/concepts/incidents)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks
