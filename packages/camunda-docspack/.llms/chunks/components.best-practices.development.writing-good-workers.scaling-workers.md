# Writing good workers — Scaling workers

If you need to process a lot of jobs, you need to think about optimizing your workers.

Workers can control the number of jobs retrieved at once. In a busy system it makes sense to not only request one job, but probably 20 or even up to 50 jobs in one remote request to the workflow engine, and then start working on them locally. In a lesser utilized system, long polling is used to avoid delays when a job comes in. Long polling means the client’s request to fetch jobs is blocked until a job is received (or some timeout hits). Therefore, the client does not constantly need to ask.

You will have jobs in your local application that need to be processed. The worst case in terms of scalability is that you process the jobs sequentially one after the other. While this sounds bad, it is still a valid approach for many use cases, as most projects do not need any parallel processing in the worker code as they simply do not care whether a job is executed a second earlier or later. Think of a business process that is executed only some hundred times per day and includes mostly human tasks — a sequential worker is totally sufficient. In this case, you can skip this paragraph section.

However, you might need to do better and process jobs in parallel. In such a case, you should read on and understand the difference between writing blocking code on platform threads, blocking code on virtual threads, and non-blocking code.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
