# Modeling with situation patterns — Escalating a situation step by step — Option 2: Using gateways forming a loop

Diagram (BPMN):
  start "Good needed" → user task "Order good" → exclusive gateway → event-based gateway
    — intermediate catch event "Good delivered" → end "Good received"
    — intermediate catch event "Reasonable time passed" → exclusive gateway "Dealer already reminded?"
      — [No: =not(reminded)] user task "Remind dealer" → (back to exclusive gateway)
      — [Yes: =reminded] user task "Cancel order" → end "Good not received"
  note: Note that the timer label needs to be more generic here

**(1)**

After having ordered the goods, the process passively waits for the success case by means of an event-based gateway: the goods should be delivered. However, in case this does not happen within a reasonable time...

**(2)**

We choose by means of an exclusive gateway to make a _first step of escalation_: remind the dealer. We still stay optimistic. Therefore, the process returns to the event-based gateway and again passively waits for the success case: the goods should still be delivered. However, in case this does not happen again within a reasonable time, we choose a _second step of escalation_: cancel the deal.

**Evaluation:**

- This model is a more _compact_ and more _generic_ modeling solution to the situation. If it comes to multiple steps of escalation, you will need such an approach to avoid huge diagrams.

- The solution is _less explicit_. We could not choose to label the timer with explicit durations, as a single timer is used for both durations. The solution is _less readable_ for a less experienced reading public. For a fast understanding of the two step escalation, this method of modeling is less suitable.

- During the time we need to remind the dealer, we are strictly speaking not in a position to receive the goods! According to the BPMN specification, a process can handle a message event only if it is ready to receive at exactly the moment it occurs. Fortunately, Camunda 8 introduced [message buffering](https://docs.camunda.io/docs/next/components/concepts/messages#message-buffering), allowing to execute this model properly without loosing messages. Using Camunda 7, the message might get lost until we are at the second event-based gateway.

**Note**
You might want to use that pattern when modeling _escalations with multiple steps_. You should not execute it on Camunda 7.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
