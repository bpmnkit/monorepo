# Naming BPMN elements — Naming gateways

Label a data-based _exclusive gateway_ with a question. Label the outgoing sequence flows with the conditions they are executed under. Formulate the conditions as answers to the question posed at the gateway.

Diagram (BPMN):
  start "Invoice to be checked" → "Check invoice" → exclusive gateway "Invoice correct?"
    — [Yes: =correct] "Pay invoice" → end "Invoice paid"
    — [No: =not(correct)] "Reject payment of invoice" → end "Invoice rejected"

This naming approach does not always work for _inclusive gateways_, because the outgoing flows' conditions can be completely independent from each other. Still, use a question whenever possible.

Diagram (BPMN):
  start "11 am" → "Choose menu" → inclusive gateway "Selected courses?"
    — [Starter: =starter] "Prepare starter" → inclusive gateway → "Have lunch" → end "Lunch finished"
    — [Dessert: =dessert] "Prepare dessert" → (back to inclusive gateway)
    — [Main: =main] "Prepare main course" → (back to inclusive gateway)

If this is not possible, leave out the question completely but describe the conditions under which the outgoing paths are executed.

Diagram (BPMN):
  start "Order received" → "Check order" → inclusive gateway
    — [Always: =true] "Package goods" → inclusive gateway → end "Shipment prepared"
    — [Heavy good: =heavy_good] "Order pick-up service" → (back to inclusive gateway)
    — [Insurance necessary: =insurance_necessary] "Effect an insurance" → (back to inclusive gateway)

_Avoid naming event-based gateways_, but ensure you name their subsequent events. Also, avoid naming _parallel gateways_ and all forms of _joining gateways_. You don't need to specify anything about those gateways, as the flow semantics are always the same.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements
