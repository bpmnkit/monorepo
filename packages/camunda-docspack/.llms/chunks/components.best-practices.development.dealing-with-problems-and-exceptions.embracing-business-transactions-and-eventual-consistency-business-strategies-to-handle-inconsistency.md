# Dealing with problems and exceptions — Embracing business transactions and eventual consistency — Business strategies to handle inconsistency

There are three basic strategies if a consistency problem occurs:

- Ignore it. While it sounds strange to consider ignoring a consistency issue, it actually can be a valid strategy. It’s a question of how much business impact the inconsistency may have.
- Apologize. This is an extension of the strategy to ignore. You don’t try to prevent inconsistencies, but you do make sure that you apologize when their effects come to light.
- Resolve it. Tackle the problem head-on and actively resolve the inconsistency. This could be done by different means, such as the reconciliation jobs mentioned earlier, but this practice focuses on how BPMN can help by looking into the Saga pattern.

Selecting the right strategy is a clear business decision, as none of them are right or wrong, but simply more or less well suited to the situation at hand. You should always think about the cost/value ratio.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
