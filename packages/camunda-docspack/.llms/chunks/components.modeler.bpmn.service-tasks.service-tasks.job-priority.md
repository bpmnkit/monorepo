# Service tasks — Job priority

This task type supports `zeebe:jobPriorityDefinition`.

You can define job priority on the process as a default and override it on this task.
For priority behavior and limitations, see [Job prioritization](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-prioritization).


## Additional resources

### XML representation

A service task with a custom header and priority definition:

```xml
<bpmn:serviceTask id="collect-money" name="Collect Money">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="payment-service" retries="5" />
    <zeebe:taskHeaders>
      <zeebe:header key="method" value="VISA" />
    </zeebe:taskHeaders>
    <zeebe:jobPriorityDefinition priority="90" />
  </bpmn:extensionElements>
</bpmn:serviceTask>
```


## Next steps

Learn more about the concept of job types and how to set up a job worker via our [manual on job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers).

### References

- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)
- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
- [Incidents](https://docs.camunda.io/docs/next/components/concepts/incidents)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks
