# Versioning process definitions — Dealing with long running processes — Using call activities to influence versioning behaviour of pieces

When calling separately modeled subprocesses (i.e. _Call Activities_), the default behavior of the process engine is to call the _latest_ deployed version of that subprocess. You can change this default 'binding' behavior to call a _specific_ version or the version which was _deployed_ together with the parent process.

Keeping in mind pros and cons of versioning as discussed above, we can therefore _encapsulate parts of a process_, for which we want to be able to change the runtime behavior more often into such call activities. This is an especially useful consideration for _long-running processes_.

Diagram (BPMN):
  start "Order received" → call activity "Order acceptance" → intermediate throw event "Order accepted" → call activity "Order Shipping" → intermediate throw event "Order shipped" → call activity "Order Billing" → end "Order fulfilled"
  note: binding: latest
  note: binding: deployment

**(1)**

We could decide that we always want to follow the _latest_ shipping process changes, even if the rules for shipping changed while we are in the order acceptance phase. We for example reason that this acceptance phase could sometimes take a long time, because the procurement for goods currently not shelved happens within that phase.

**(2)**

Contrary to that, we could decide that the order billing always happens according to the rules valid at the moment we received the order and instantiated the parent process (_deployment_). We for example reason here that it is critical that the billing follows the rules communicated to the customer together with the offer.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
