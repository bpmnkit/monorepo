# Naming BPMN elements — Naming events

Wherever possible, name an _event_ using an object and a verb reflecting a state. Always try to describe _which state an object is in_ when the process is about to leave the event.

Diagram (BPMN):
  start "Draft reviewed"

This naming approach does not always work perfectly. In those cases, precisely describe the business semantics when the process is about to leave the event. The following names are also valid:

Diagram (BPMN):
  start "Draft to be reviewed"

Be specific about the state you reached with your event from a business perspective. Often, you will reach "success" and "failure" like events from a business perspective:

Diagram (BPMN):
  start "Invoice to be checked" → "Check invoice" → exclusive gateway "Invoice correct?"
    — [Yes: =correct] "Pay invoice" → end "Invoice paid"
    — [No: =not(correct)] "Reject payment of invoice" → end "Invoice rejected"

**(1)**

"Invoice paid" better qualifies the "successful" business state than "Invoice processed" would...

**(2)**

...because in principle, you can call the failed state "Invoice processed", too, but the reader of the diagram is much better informed by calling it "Invoice rejected".

**Note**
Avoid very broad and general verbs like "Invoice processed" or "Order handled"!

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements
