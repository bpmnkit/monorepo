# Modeling with situation patterns — Asking multiple recipients for a single reply

You offer something to or request something from multiple communication partners, but you actually just need the first reply.

We sometimes also call that pattern **first come, first serve**.

**Example:** A well-known personal transportation startup works with a system of relatively independent drivers. "Of course, when the customer requests a tour, speed is everything. Therefore, we need to limit a tour to those of our drivers who are close by. Of course, there might be several drivers within a similar distance. We then just offer the tour to all of them!"

### Using a multi-instance task

Diagram (BPMN):
  start "Tour requested" → service task "Offer tour on platform" → service task "Determine drivers nearby pickup location" → send task "Message tour to nearby driver's" → intermediate catch event "Tour accepted" → end "Driver approaching"

Diagram (BPMN):
  start "Push offering received" → "Review offering" → exclusive gateway "Tour interesting?"
    — [Yes: =interesting] "Accept tour" → end "Tour accepted"
    — [No: =not(interesting)] end "Tour declined"
  note: This attempt to accept the tour might be unsuccessful

**(1)**

After determining all drivers currently close enough to serve the customer, we push the information about the tour to all of those drivers.

**(2)**

We then wait for the reply of a single driver. Once we have it, the process won't wait any longer, proceeds to the end event, and informs the customer about the approaching driver.

According to the process model, it is possible that another driver accepts the tour as well. However, as the process in the tour offering system is not waiting for the message anymore, it will get lost. As our process proceeded to the end event after the first reply, all subsequent messages are intentionally ignored in this process design.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
