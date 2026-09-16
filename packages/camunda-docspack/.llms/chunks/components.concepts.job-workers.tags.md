# Job workers — Tags

Tags provide a powerful way to add lightweight metadata to jobs.

### How tags work with jobs

When a BPMN element is activated and creates a job:

1. **Snapshot creation**: The job receives a copy of all tags from the process instance at that exact moment.
2. **Immutability**: Once copied to the job, tags cannot be modified, added, or removed.
3. **Worker access**: Job workers can read these tags to implement custom logic.

### Key characteristics

- **Case-sensitive**: Tags `Priority:High` and `priority:high` are different.
- **Timing**: Tags are copied exactly once when the job is created from the BPMN element.
- **Immutable**: The tag set on a job never changes after creation.
- **Inherited**: Jobs inherit the complete tag set from their process instance.

For detailed information about tag formats, validation rules, limits, and additional use cases, see [process instance creation tags](https://docs.camunda.io/docs/next/components/concepts/process-instance-creation#tags).

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
