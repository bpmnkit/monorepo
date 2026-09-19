# Dealing with problems and exceptions — Handling exceptions on a technical level — Writing idempotent workers

Zeebe uses the **at-least-once strategy** for job handlers, which is a typical choice in distributed systems. This means that the process instance only advances in the happy case (the job was completed, the workflow engine received the complete job request and committed it). A typical failure case occurs when the worker who polled the job crashes and cannot complete the job anymore. [In this case, the workflow engine gives the job to another worker after a configured timeout](https://docs.camunda.io/docs/next/components/concepts/job-workers#timeouts). This ensures that the job handler is executed at least once.

But this can mean that the handler is executed more than once! You need to consider this in your handler code, as the handler might be called more than one time. The [technical term describing this is idempotency](https://en.wikipedia.org/wiki/Idempotence).

For example, typical strategies are described in [3 common pitfalls in microservice integration — and how to avoid them](https://blog.bernd-ruecker.com/3-common-pitfalls-in-microservice-integration-and-how-to-avoid-them-3f27a442cd07). One possibility is to ask the service provider if it has already seen the same request. A more common approach is to implement the service provider in a way that allows for duplicate calls. There are two ways of mastering this:

- **Natural idempotency**. Some methods can be executed as often as you want because they just flip some state. Example: `confirmCustomer()`.
- **Business idempotency**. Sometimes you have business identifiers that allow you to detect duplicate calls (e.g. by keeping a database of records that you can check). Example: `createCustomer(email)`.

If these approaches do not work, you will need to add a **custom idempotency handling** by using unique IDs or hashes. For example, you can generate a unique identifier and add it to the call. This way, a duplicate call can be easily spotted if you store that ID on the service provider side. If you leverage a workflow engine you probably can let it do the heavy lifting. Example: `charge(transactionId, amount)`.

See this snippet of a process about how to support custom idempotency handling in a process model:

Diagram (BPMN):
  service task "Create transaction id" → service task "Charge credit card"

Whatever strategy you use, make sure that you’ve considered idempotency consciously.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
