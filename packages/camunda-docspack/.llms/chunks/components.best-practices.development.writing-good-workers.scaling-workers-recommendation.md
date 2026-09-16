# Writing good workers — Scaling workers — Recommendation

In Java 21 and later, prefer virtual threads for I/O-bound job workers that need parallel processing. They keep worker code easier to read while avoiding most of the scalability limits of platform threads. Use reactive programming when your client stack already uses it, or when you need extremely high throughput or low latency and have measured that the lower overhead is worth the complexity.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
