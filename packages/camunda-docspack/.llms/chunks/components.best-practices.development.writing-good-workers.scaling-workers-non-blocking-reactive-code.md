# Writing good workers — Scaling workers — Non-blocking / reactive code

Reactive programming uses a different approach to achieve parallel work: extract the waiting part from your code.

With a reactive HTTP client you will write code to issue the REST request, but then not block for the response. Instead, you define a callback as to what happens if the request returns. Most of you know this from JavaScript programming. Thus, the runtime can optimize the utilization of threads itself, without you the developer even knowing.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
