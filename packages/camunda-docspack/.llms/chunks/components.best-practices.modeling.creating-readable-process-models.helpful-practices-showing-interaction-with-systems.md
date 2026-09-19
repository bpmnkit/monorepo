# Creating readable process models — Helpful practices — Showing interaction with systems

Consciously decide how you want to model systems the process participants are interacting with. Use _data stores_ to show systems which primarily serve as a means to store and retrieve data. Use - depending on your needs _collapsed_ or _expanded_ - _pools_ for systems which are carrying out crucial activities in the process going way beyond storing and retrieving data.

Diagram (BPMN): Team Assistence - Invoice Collection
  start "Invoice received" → "Check invoice" → exclusive gateway "Invoice correct?"
    — [No] "Request new invoice" → end "New invoice requested"
    — [Yes] "Scan invoice" → end "Invoice sent to be approved"

Diagram (BPMN): Managing director - Invoice payment
  start "Invoice payment started" → "Determine invoices to be paid" → exclusive gateway "Invoices to be paid exist?"
    — [Yes] "Transfer money" → "Mark invoice as paid" → end "Invoice paid"
    — [No] end "No invoices to be paid"

Diagram (BPMN): Approver - Invoice approval
  start "Invoice approval requested" → "Check invoice" → exclusive gateway "Invoice approved?"
    — [Yes] "Request payment" → end "Invoice approved"
    — [No] "Request invoice clarification" → end "Invoice not approved"

Diagram (BPMN): Team Assistence - Invoice clarification
  start "Invoice clarification requested" → "Clarify invoice" → exclusive gateway "Clarification successful?"
    — [No] "Document result" → end "Invoice not clarified"
    — [Yes] "Request new invoice approval" → end "Invoice clarified"

**(1)**

A _collapsed pool_ is used to represent a system which supports the process and/or carries out process tasks on its own. The pool could be expanded later to model the internal system details, maybe even with the goal to execute a technical process flow directly with a BPMN capable process engine.

**(2)**

A _data store_ is used to represent a technical container meant to archive PDFs and store them for later retrieval.

**(3)**

Another _data store_ is used to represent a container which could be a physical storage place for paper invoices to be paid at the moment but could become a representation for business objects in a database with the object state "to be paid" in the future.

When _choosing_ between those _two options_ for modeling systems (data stores, collapsed pools) keep in mind that only pools represent processes and therefore have the capability to be expanded and modeled in all their internal details later on.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
