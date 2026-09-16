# Job workers — Job streaming — How it works

Job streaming works by having the worker open a long living gRPC unidirectional stream from the client to the gateway. The gateway then aggregates logically equivalent streams and registers each of these aggregated streams to every broker.

**Note**
Two streams are considered logically equivalent if they would both activate the same job in the exact same way. More concretely, this means if they:

- Target the same job type
- Have the same worker name
- Have the same job activation timeout
- Have the same fetch variables

On the broker side, whenever a job is made activate-able (e.g. a service task is activated, a job failed and is retried, etc.), if there is one or more streams for this job type, a random one is picked, the job is activated and pushed to it. As the job makes its way back to the gateway that owns this stream, a random client associated with it is picked, and the job is forwarded to it.

**Note**
The RNG used to randomly pick streams and clients provides a good uniform distribution for the same underlying set, which is a cheap way of evenly distributing the load _as long as the stream set remains stable_.

Job leasing also applies to streaming: a leased job only matches streams opened with a lease request, and streams opened without one only match unleased jobs. See [job leasing](#job-leasing) for details.

If a job contains unresolved secret references, the broker requests resolution before pushing the job. Once the references resolve, the broker pushes the job. See [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

To help visualize the process in general, here is a sequence diagram which shows a single worker opening a job stream for jobs of type "foo" against a cluster consisting of a single gateway and a single broker. It receives some jobs, and when it closes, one job that was pushed asynchronously is returned to the broker:

![Sample Sequence Diagram](assets/job-push-sequence.png)

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
