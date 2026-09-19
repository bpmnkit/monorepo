# Creating readable process models — Helpful practices — Using collaboration diagrams

If you model on an operational level (refer to [BPMN Tutorial](https://camunda.com/bpmn/) and [Real-Life BPMN](https://www.amazon.com/Real-Life-BPMN-4th-introduction-DMN/dp/1086302095/) on details for modeling levels) use _collaboration diagrams_ with several _separate pools_ for the process participants [instead of lanes](#avoiding-lanes) as operational models using lanes make it very hard for the individual process participant to identify the details of their process involvement.

Furthermore, model just _one coherent process per pool_ (apart from event subprocesses, of course), even though BPMN in principle allows several processes per pool. This improves readability by constituting a clear visual border around every process and by providing a natural space for labeling that part of the end-to-end process in the pool's header.

Diagram (BPMN): Team Assistence - Invoice Collection
  start "Invoice received" → "Check invoice" → exclusive gateway "Invoice correct?"
    — [No] "Request new invoice" → end "New invoice requested"
    — [Yes] "Scan invoice" → "Request invoice approval" → end "Invoice sent to be approved"

Diagram (BPMN): Managing director - Invoice payment
  start "Invoice payment started" → "Determine invoices to be paid" → exclusive gateway "Invoices to be paid exist?"
    — [Yes] "Transfer money" → "Mark invoice as paid" → end "Invoice paid"
    — [No] end "No invoices to be paid"

Diagram (BPMN): Approver - Invoice approval
  start "Invoice approval requested" → "Check invoice" → exclusive gateway "Invoice approved?"
    — [No] "Request invoice clarification" → end "Invoice not approved"
    — [Yes] "Request payment" → end "Invoice approved"

Diagram (BPMN): Team Assistence - Invoice clarification
  start "Invoice clarification requested" → "Clarify invoice" → exclusive gateway "Clarification successful?"
    — [No] "Document result" → end "Invoice not clarified"
    — [Yes] "Request new invoice approval" → end "Invoice clarified"

**(1)**

The Team Assistance is responsible for initial "Invoice Collection" as well as "Invoice Clarification" - if applicable. Those two processes are modeled by using two separate pools for the team assistance, just as...

**(2)**

...the approver can observe the "Invoice Approval" process in a separate pool and...

**(3)**

...the managing director can observe the "Invoice Payment" process in a separate pool while the collaboration diagram as a whole shows the business analyst that the overall end-to-end process works.

Using _collaboration diagrams_ with _separate pools_ for the process participants allows to explicitly show interaction and communication between them by means of message flow and further improves readability by transparently showing the participants their own involvement in the end-to-end-process. As a consequence, they do not need to fully read and understand the end-to-end process in order to read, understand, and agree to their own involvement by looking at their own pools.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
