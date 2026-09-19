# Ad-hoc sub-processes — Job worker implementation

You can handle an ad-hoc sub-process using a [job worker](https://docs.camunda.io/docs/next/components/concepts/job-workers). To do this, define the sub-process with a task definition. The job worker can then control the sub-process by activating inner elements and deciding when it completes.

When an ad-hoc sub-process is defined as a job worker, it creates a job upon activation. The worker must decide what the next step is. It can use the `adHocSubProcessElements` variable (see [special ad-hoc sub-process variables](#special-ad-hoc-sub-process-variables)) to determine available elements.

When a process instance reaches an ad-hoc sub-process with a job worker implementation:

![A sequence diagram showing the flow of how a job worker interacts with an ad-hoc sub-process.](assets/ad-hoc-subprocess-job-sequence-diagram.png)

1. Zeebe creates a corresponding job and waits for its completion.
2. The job worker decides which elements to activate and completes the job with an [`adHocSubProcess` job result](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/complete-job.api).
3. Zeebe activates the elements from the job result.
4. When any of the flows inside the ad-hoc sub-process completes, Zeebe creates a new job for the ad-hoc sub-process.
5. The job worker decides the next step. It can activate more elements or fulfill the completion condition. If the condition is fulfilled, the job worker can specify whether to cancel active elements. It cannot fulfill both the completion condition and activate new elements at the same time.

Because a worker can activate multiple elements at once, and Zeebe creates a job whenever one completes, the job for the ad-hoc sub-process may be recreated during execution. There is only one active job for the ad-hoc sub-process at a time. The job worker should expect that:

- A job may be recreated while it is still processing.
- Job completion may result in a `NOT_FOUND` rejection.

### Event sub-processes

In an ad-hoc sub-process handled by a job worker, the job worker decides which elements to activate and when the ad-hoc sub-process is complete.

However, [event sub-processes](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses) are triggered by events, not by the job worker, so they can run outside the job worker's direct control. When an event sub-process finishes, it triggers the job worker again, handing control back so it can activate new elements (optionally canceling others) or complete the ad-hoc sub-process.

**Info: Interrupting event sub-process**
An interrupting event sub-process is a special case: it cancels all active elements and completes the ad-hoc sub-process without waiting for the job worker to decide.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses
