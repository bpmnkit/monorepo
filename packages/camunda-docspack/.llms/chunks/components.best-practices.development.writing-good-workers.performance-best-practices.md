# Writing good workers — Performance best-practices

Most of the business logic in your process models will likely end up being worked on as a job. As such, optimizing how jobs are handled in Zeebe can have
a big impact on the performance of your system as a whole. Here are some best practices to keep things running smoothly.

### Reduce latency by enabling job streaming

We recommend enabling [job streaming](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-streaming) in order to reduce latency to a maximum. Essentially, when using long polling,
your job workers have to periodically poll every partition in your Zeebe cluster to check if there are new jobs available. Additionally, they have to
balance polling aggressively with minimizing their impact on the cluster, which still has to handle all requests, even when no jobs are available. In large clusters, this can add a noticeable delay in the order of seconds, which can be unacceptable for certain workloads.

> [!Note]
> You can read more about the difference between long polling and job streaming [in this blog post](https://camunda.com/blog/2024/03/reducing-job-activation-delay-zeebe/).

As such, we recommend using job streaming if possible.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
