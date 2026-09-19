# Workflow patterns — Business transactions

Modern systems are highly distributed across the network. In such systems, you cannot rely on technical ACID transactions for consistency, but need to elevate decisions around consistency or regaining consistency to the business level. Refer to [Achieving consistency without transaction managers](https://blog.bernd-ruecker.com/achieving-consistency-without-transaction-managers-7cb480bd08c) for additional background on this.

### Compensation

An important problem to solve is how to roll back a business transaction in case of problems. In other words, how to restore business consistency. One strategy is to leverage compensating activities to undo the original actions whenever the problem occurs. This is also known as the [Saga Pattern](https://blog.bernd-ruecker.com/saga-how-to-implement-complex-business-transactions-without-two-phase-commit-e00aa41a1b1b).

In BPMN, you can use [compensation events](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage) to easily implement compensations in your processes.

Diagram (BPMN):
  start "Payment required" → service task "Check customers balance" → exclusive gateway "Credit on customer account available?"
    — [Yes] service task "Deduct from customers balance" → exclusive gateway → exclusive gateway "Payment type"
      — [Credit card] service task "Charge credit card" → exclusive gateway → end "..."
      — [direct debit] service task "Debit bank account" → (back to exclusive gateway)
      — [...] service task "..." → (back to exclusive gateway)
    — [No] (back to exclusive gateway)

**(1)**

**(2)**

**(3)**

This compensation task is connected to the original task by a dedicated compensation event.

**(4)**

Within your process model, you can define when it is time to compensate. Whenever you trigger the compensation event, all tasks of the current scope that were executed are automatically compensated. This means that their configured compensation task is executed.

The big advantage is that you don't have to remodel the routing logic to compensate correctly, like checking again if the customer balance was used. The workflow engine will take care automatically, also in more complicated situations like multiple instance activities.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
