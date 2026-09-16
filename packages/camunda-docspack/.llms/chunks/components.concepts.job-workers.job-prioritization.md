# Job workers — Job prioritization

Use job prioritization when you have mixed-urgency workloads and want time-sensitive jobs to be activated ahead of lower-priority ones.

Camunda supports job prioritization for pull-based job activation. Job priority affects the order in which jobs are activated for workers. It does not change retries, failures, or completion semantics.

Priority ordering is automatic. No worker-level flag or configuration is required — once a job has a priority set, Zeebe activates higher-priority jobs first when a job pull method is used.

You can define job priority:

- On the process as a default.
- On supported job-creating tasks as an override, including service tasks, send tasks, and script or business rule tasks implemented as job workers.

### Process-level priority

To set a default priority for all jobs created by a process, add `zeebe:jobPriorityDefinition` to the process `extensionElements`:

```xml
<bpmn:process id="my-process" isExecutable="true">
  <bpmn:extensionElements>
    <zeebe:jobPriorityDefinition priority="42" />
  </bpmn:extensionElements>
  ...
</bpmn:process>
```

A task-level priority definition overrides this process-level default.

### Task-level priority

Job priority is enforced per partition, not globally across the cluster. Within a partition, higher-priority jobs are activated before lower-priority ones. Within the same priority level, jobs activate in FIFO order. If you don't set any priorities, standard FIFO behavior applies throughout.

The default priority is 0.

Be aware that low-priority jobs can starve if workers are consistently occupied by higher-priority work. Camunda doesn't provide starvation mitigation, fairness guarantees, or priority aging. If starvation becomes a problem, increase worker capacity or revise your priority assignments.

Priority values can be static integers or FEEL expressions. FEEL expressions are evaluated when the job is created, and the resulting integer is stored on the job.

Priority accepts any signed 32-bit integer. The engine does not enforce a fixed upper or lower bound such as `0-99`.

Jobs created before version 8.10 do not have a stored priority value. For job execution, Camunda treats them as having the default priority of 0.

**Warning**
If you use job APIs that filter or sort by priority, pre-8.10 jobs are excluded from results because no priority value is stored for them. Review any priority-based queries before upgrading.

### Validation and runtime failure behavior

Invalid FEEL expressions are handled differently depending on when they fail:

- If the expression is invalid at deployment time, BPMN deployment fails and the process is not deployed.
- If the expression fails at runtime, for example because a referenced variable is missing, Camunda raises an incident and the job is not created.

To recover, provide the missing variable value and resolve the incident manually in Operate.

### Job streaming limitation

Job streaming activates jobs as they are created and ignores priorities.

If you use job pulling and job streaming together for the same job type, this negates the benefits of job prioritization.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
