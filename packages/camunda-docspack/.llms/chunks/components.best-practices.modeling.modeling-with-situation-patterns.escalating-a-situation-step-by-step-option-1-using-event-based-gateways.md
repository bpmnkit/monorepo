# Modeling with situation patterns — Escalating a situation step by step — Option 1: Using event-based gateways

Diagram (BPMN):
  start "Good needed" → user task "Order good" → event-based gateway
    — intermediate catch event "Good delivered" → exclusive gateway → end "Good received"
    — intermediate catch event "Reasonable time for reminder passed" → user task "Remind dealer" → event-based gateway
      — intermediate catch event "Good delivered" → (back to exclusive gateway)
      — intermediate catch event "Reasonable time for delivery ultimately passed" → user task "Cancel order" → end "Good not received"

**(1)**

After ordering the goods, the process passively waits for the success case by means of an event-based gateway: the goods should be delivered. However, in case this does not happen within a reasonable time, we make a first step of escalation: remind the dealer.

**(2)**

We still stay optimistic. Therefore, the process again passively waits for the success case by means of another event-based gateway: the goods should still be delivered. However, in case this does not happen again within a reasonable time, we make a second step of escalation: cancel the deal.

**Evaluation:**

- This solution explicitly shows how the two steps of this escalation are performed. Timers are modeled separately, followed by their corresponding escalation activities.

- The usage of separate event-based gateways leads to _duplication_ (for example, of the receiving message events) and makes the model _larger_, even more so in case multiple steps of escalation need to be modeled.

- During the time we need to remind the dealer, we are strictly speaking not in a position to receive the goods! According to the BPMN specification, a process can handle a message event only if it is ready to receive at exactly the moment it occurs. Fortunately, Camunda 8 introduced [message buffering](https://docs.camunda.io/docs/next/components/concepts/messages#message-buffering), allowing to execute this model properly without loosing messages. Using Camunda 7, the message might get lost until we are at the second event-based gateway.

**Note**
You might want to use that pattern when modeling _simple two phase escalations_. You should not execute it on Camunda 7.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
