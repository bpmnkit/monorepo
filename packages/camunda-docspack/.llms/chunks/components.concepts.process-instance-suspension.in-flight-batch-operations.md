# Process instance suspension — In-flight batch operations

Batch operations already queued against process instances that are subsequently suspended may fail on individual items if the instance state is incompatible with the queued operation. An individual item failure does not stop the rest of the batch.


## Technical implications

This section explains how suspension is handled internally to help you understand processing impact, resume timing, and consistency behavior.

### Suspension and resumption in the engine

At the engine level, suspension for a process instance means that:

- Jobs waiting for execution are removed from the execution pool and re-added on resumption.
- Completion and failure of already-active jobs are rejected during suspension.
- Execution progress is stopped via command buffering: after suspension, the next command that would advance execution is buffered instead of processed. On resume, the engine drains the buffer in order, which restarts normal execution.

Additionally:

- On suspend, all active message subscriptions for the process instance are removed and re-added on resume.
- Timer triggers are buffered during suspension and not rescheduled for recurring timers until they trigger on resumption. Timer expirations during suspension therefore increase the command buffer.

### Implications

- **Broker PVC usage**: Buffered commands are stored on the broker's persistent volume (PVC). A process instance with many active tokens or long-lived subscriptions generates more buffered commands during suspension. Monitor PVC utilization when suspending large numbers of instances or instances with complex execution states.
- **Suspension processing load**: Suspending process instances with a large number of active jobs or message subscriptions increases cluster load during the suspension window.
- **Resumption processing load**: Resuming a process instance is roughly equivalent to simultaneously creating all active element instances that were suspended. Resuming a large number of instances, or an instance with many active tokens, can noticeably reduce processing throughput.
- **Stale data in buffered commands**: Buffered commands are recorded at the time of suspension and may rely on data that changes while the instance is suspended. Because some actions are permitted during suspension (such as variable updates), a buffered command may operate on stale values when it drains on resume, potentially producing unexpected behavior or incidents.

### Resume failures

In rare cases, a buffered command can't be drained, for example, if a preceding permitted change left the instance in an inconsistent state for that command. This typically surfaces as an incident on resume. In very rare cases, a drain failure may not surface as an incident if the failure is unrelated to process-instance-specific command processing. In that case, the process instance continues to show as `SUSPENDED` but can't complete draining. Check error logs for details and contact support if necessary.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
