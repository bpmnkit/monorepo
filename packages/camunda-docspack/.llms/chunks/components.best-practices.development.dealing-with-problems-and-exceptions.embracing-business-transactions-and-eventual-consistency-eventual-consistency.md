# Dealing with problems and exceptions — Embracing business transactions and eventual consistency — Eventual consistency

It is important to be aware that these temporary inconsistencies are possible. You also have to understand the failure scenarios they can cause. In the above example, you could have created a marketing campaign at a moment when a customer was already in the CRM system, but not yet in billing, so they got included in that list. Then, even if their order gets rejected and they never end up as an active customer, they might still receive an upgrade advertisement.

You need to understand the effects of this happening. Furthermore, you have to think about a strategy to resolve inconsistencies. The term **eventual consistency** suggests that you need to take measures to get back to a consistent state eventually. In the onboarding example, this could mean you need to deactivate the customer in the CRM system if adding them to the billing system fails. This leads to the consistent state that the customer is not visible in any system anymore.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
