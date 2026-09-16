# Dealing with problems and exceptions — Embracing business transactions and eventual consistency — The Saga pattern and BPMN compensation

The Saga pattern describes long-running transactions in distributed systems. The main idea is simple: when you can’t roll back tasks, you undo them. (The name Saga refers back to a paper written in the 1980s about long-lived transactions in databases.)

Camunda supports this through BPMN compensation events, which can link tasks with their undo tasks.

Diagram (BPMN):
  start "Customer order received" → parallel gateway
    — service task "Add customer to CRM system" → parallel gateway → service task "Provision SIM card" → service task "Register SIM in network" → end "Customer order processed"
    — service task "Add customer to billing system" → (back to parallel gateway)

**(1)**

Assume the customer was already added to the CRM system...

**(2)**

...when an error occurred...

**(3)**

...the process triggers the compensation to happen. This will roll back the business transaction.

**(4)**

All compensating activities of successfully completed tasks will be executed, in this case also this one.

**(5)**

As a result, the customer will be deactivated, as the API of the CRM system might not allow to simply delete it.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
