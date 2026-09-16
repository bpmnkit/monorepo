# Creating readable process models — Helpful practices — Avoiding excessive usage of data objects

Avoid excessive use of _data objects_, but use them cautiously to show the _most important data related aspects_ of your process.

Experience shows that many data objects and especially many data associations quickly clutter your process model and that visual noise reduces readability - especially for less experienced readers.

You might find three practices helpful to find your own "right" amount of data visualization:

Diagram (BPMN): Delivery Service - Payment Creation
  start "Payment necessary" → "Create new payment" → "Check new payment" → exclusive gateway "Payment correct?"
    — [Yes] "Save payment" → end "Payment created"
    — [No] "Reset new payment" → (back to "Create new payment")

Diagram (BPMN): Bookkeeping - Payments Processing
  start "Daily" → "Search for payments created" → exclusive gateway "Payments found?"
    — [Yes] subprocess → end "Payments processing finished"
    — [No] end "Check not possible"

Diagram (BPMN): Adjustment Specialist - Adjustment Check
  start "Adjustment to be checked" → "Search for adjustment possibility" → exclusive gateway "Adjustment possible?"
    — [Yes] "Prepare adjustment in detail" → exclusive gateway → end "Adjustment checked"
    — [No] (back to exclusive gateway)

**(1)**

Cautiously use data objects and associations to show the _most important data related aspects_ of your process. We could have modeled that all the tasks in the "Payments Creation" process either read, update, or delete the "new payment", however we decided that we just want to point out that the process works on a new payment object.

**(2)**

Use data stores for _coupling processes via data_. We could have modeled a lot of other tasks in the process that either read or update the "payments", however, we decided to just point out the most important aspect for the process diagram, which is that the "Payments Creation" process of delivery service is loosely coupled with the "Payments Processing" via commonly shared data.

**(3)**

Here we decided that it's helpful to know that this message does not only inform an adjustment possibility was checked, but that it also delivers all the necessary details of the adjustment.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
