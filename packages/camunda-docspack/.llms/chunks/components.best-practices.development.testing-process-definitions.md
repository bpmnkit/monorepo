# Testing process definitions

Test your executable BPMN processes as they are software. If possible, do automated unit tests with a fast in-memory workflow engine.

Test your executable BPMN processes as you would any software. When possible, write fast automated unit tests using a localized and isolated workflow engine. Before releasing, verify your implementation with integration tests in an environment that closely mirrors your production setup, which may include human-driven, exploratory integration tests.

This best practice uses the following process example for incoming invoices that need to be approved:

Diagram (BPMN):
  start "Invoice received" → user task "Approve invoice" → exclusive gateway "Approved?"
    — [yes] service task "Archive invoice" → service task "Add invoice to accounting system" → end "Invoice approved"
    — [no] service task "Send invoice rejection" → end "Invoice rejected"

**(1)**

Invoices need to be approved.

**(2)**

The invoice sender is notified about a rejection.

**(3)**

Approved invoices get processed.

**(4)**

If the approval task takes too long, the process takes an alternative path—in this case, the invoice is automatically approved.

**(5)**

If an error occurs while communicating with the archive system (assume you have an unreliable legacy system), the process takes a detour to handle this situation manually.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
