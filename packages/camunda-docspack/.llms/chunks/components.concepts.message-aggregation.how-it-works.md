# Message aggregation — How it works

1. Each message is published with:
   - A **message name** (for example, `"ItemReceived"`)
   - A **correlation key** (for example, `"order-123"`)
   - Optionally, a **time-to-live (TTL)** greater than `0`
2. The first message starts a new process instance.
3. All subsequent messages with the same correlation key are correlated to that instance.
4. The workflow collects the message data (for example, appending to a list).
5. Once all expected messages are received, the process continues.

If additional messages with the same correlation key arrive after the process instance has completed, a new instance is created automatically.

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation
