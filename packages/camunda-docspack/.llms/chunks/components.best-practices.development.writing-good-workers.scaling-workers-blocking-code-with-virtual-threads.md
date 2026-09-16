# Writing good workers — Scaling workers — Blocking code with virtual threads

Virtual threads let you keep a straightforward blocking programming model while avoiding the cost of assigning one platform thread to every blocked operation. This makes them a good default for Java workers that spend most of their time waiting for I/O, such as REST calls or database requests.

Use virtual threads when you run on Java 21 or later and want to process many I/O-bound jobs in parallel without rewriting your worker code into a reactive style. Reactive programming can still be useful for extremely high-throughput or low-latency scenarios where the lower overhead matters enough to justify the added complexity.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
