# Choosing the DMN hit policy — Understanding DMN hit policy use cases — Collect: deciding which groups of people may review an order

With hit policy **collect**, you do not care about the order or any interdependencies between your rules at all. Instead, you just "collect" independent rules and care about the question which rules are applicable to your specific case.

Consider, for example, the question of "who is allowed" to carry out some action, as, for example, reviewing and deciding about incoming orders:

As a result of this decision table, we will either get `["Sales"]` or `["Management"]` or a list of both groups `["Sales", "Management"]`.

We could use this information to route the order into the applicable group's task lists or control access rights of a configurable software solution, etc. Of course, you could at any time introduce more rules and eventually also differentiate between more groups without changing your software solution.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
