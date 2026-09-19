# Send tasks — Job priority

This task type supports `zeebe:jobPriorityDefinition`.

You can define job priority on the process as a default and override it on this task.
For priority behavior and limitations, see [Job prioritization](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-prioritization).


## Additional resources

**Tip: Community Extension**

Review the [Kafka Connect Zeebe](https://github.com/camunda-community-hub/kafka-connect-zeebe). This is a
community extension that provides a job worker to publish messages to a Kafka topic. You can run it,
or use it as a blueprint for your own job worker.

### XML representation

A script task with a custom header:

```xml
<bpmn:sendTask id="publish-message" name="Publish message">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="kafka" />
    <zeebe:taskHeaders>
      <zeebe:header key="kafka-topic" value="payment" />
    </zeebe:taskHeaders>
    <zeebe:jobPriorityDefinition priority="90" />
  </bpmn:extensionElements>
</bpmn:sendTask>
```

### References

- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks
