# Script tasks — Job priority

This task type supports `zeebe:jobPriorityDefinition` when implemented as a job worker.

You can define job priority on the process as a default and override it on this task.
For priority behavior and limitations, see [Job prioritization](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-prioritization).


## Additional resources

**Tip: Community Extension**

Review the [Zeebe Script Worker](https://github.com/camunda-community-hub/zeebe-script-worker). This is a
community extension that provides a job worker to evaluate scripts. You can run it, or use it as a
blueprint for your own job worker.

### XML representation

A script task with a custom header:

```xml
<bpmn:scriptTask id="calculate-sum" name="Calculate sum">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="script" />
    <zeebe:taskHeaders>
      <zeebe:header key="language" value="javascript" />
      <zeebe:header key="script" value="a + b" />
    </zeebe:taskHeaders>
    <zeebe:jobPriorityDefinition priority="90" />
  </bpmn:extensionElements>
</bpmn:scriptTask>
```

A script task with an inline FEEL expression:

```xml
<bpmn:scriptTask id="calculate-sum" name="Calculate sum">
  <bpmn:extensionElements>
    <zeebe:script expression="=a + b" resultVariable="sum" />
  </bpmn:extensionElements>
</bpmn:scriptTask>
```

### References

- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks
