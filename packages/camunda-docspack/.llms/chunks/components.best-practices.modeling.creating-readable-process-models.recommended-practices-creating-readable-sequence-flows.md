# Creating readable process models — Recommended practices — Creating readable sequence flows

Consciously decide whether _overlapping sequence flows_ make your model more or less readable. On one hand, avoid overlapping sequence flows where the reader will not be able to follow the flow directions anymore. Use overlapping sequence flows where it is less confusing for the reader to observe just one line representing several sequence flows leading to the same target.

Avoid sequence flows _violating the reading direction_, meaning no outgoing flows on the left or incoming flows on the right of a symbol.

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Determine delivery date" → exclusive gateway → "Fax order confirmation" → end "Order confirmed"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

The author could have made the five (!) sequence flows leading into the end event visible by separating them. However, by consciously choosing to partly overlap those flows, this model becomes less cluttered, therefore less confusing and easier to read.

**(2)**

The author could have attached the sequence flow, leaving this task on its left. However, this would have decreased readability, because the flow connection violates the reading direction. The same applies to incoming flows on the right of a symbol.

_Avoid flows crossing each other_ and _flows crossing many pools or lanes_, wherever possible. Rearrange the order of lanes and paths to make your sequence flows more readable. Oftentimes, removing lanes can improve readability! Rearrange the order of pools in a collaboration diagram to avoid message flows crossing pools as much as possible. Often, you will find a "natural" order of pools reflecting the order of first involvement of parties in the end-to-end process. This order will often also lead to a minimum of crossing lines.

_Avoid very long (multi page) sequence flows_, especially when flowing against the reading direction. The reader will lose any sense of what such lines actually mean. Instead, use link events to connect points which are not on the same page or screen anymore.

Diagram (BPMN):
  start "Recourse eventually possible" → "Double check possibility of recourse" → exclusive gateway "Recourse really possible?"
    — [Yes: =recoursePossible] "Send invoice" → event-based gateway
      — intermediate catch event "Objection received" → "Review objection" → exclusive gateway "Objection justified?"
        — [No: =not(justified)] exclusive gateway → "Hand over to collection agency" → exclusive gateway → "Close case" → end "Recourse case closed"
        — [Yes: =justified] (back to exclusive gateway)
      — intermediate catch event "Objection period lapsed" → (back to exclusive gateway)
      — intermediate catch event "Invoice paid" → "Book payment" → (back to exclusive gateway)
    — [No: =not(recoursePossible)] intermediate throw event "Recourse not possible"

**(1)**

You observe a throwing link event here, which...

**(2)**

...directly links to a catching link event just as if the sequence flow would have been connected.

Avoid excessive use of link events. The example above serves to show the possible usage, but at the same time, it is too small to satisfy the usage of link events in real-world scenario!

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
