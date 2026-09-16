# Creating readable process models — Recommended practices — Modeling from left to right

Model process diagrams _from left to right_. By carefully positioning symbols from left to right, according to the typical point in time at which they occur, one can improve the readability of process models significantly:

Diagram (BPMN):
  start "Recourse eventually possible" → "Double check possibility of recourse" → exclusive gateway "Recourse really possible?"
    — [Yes: =recoursePossible] "Send invoice" → event-based gateway
      — intermediate catch event "Objection received" → "Review objection" → exclusive gateway "Objection justified?"
        — [Yes: =justified] exclusive gateway → "Close case" → end "Recourse case closed"
        — [No: =not(justified)] exclusive gateway → "Hand over to collection agency" → (back to exclusive gateway)
      — intermediate catch event "Objection period lapsed" → (back to exclusive gateway)
      — intermediate catch event "Invoice paid" → "Book payment" → (back to exclusive gateway)
    — [No: =not(recoursePossible)] (back to exclusive gateway)

Modeling from left to right supports the reading direction (for western audience) and supports the human field of vision - which prefers wide screens.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
