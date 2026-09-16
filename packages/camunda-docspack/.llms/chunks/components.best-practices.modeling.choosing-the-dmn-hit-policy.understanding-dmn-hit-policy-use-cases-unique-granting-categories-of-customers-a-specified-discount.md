# Choosing the DMN hit policy — Understanding DMN hit policy use cases — Unique: granting categories of customers a specified discount

Hit policy "**Unique**" will typically make it easy to build a decision table, which ensures your rules are "complete" - in the sense that the rules do not just not overlap but cover all possible input values - so that you do not "forget" anything.

**(1)**

The _input_ area of each row specifies a certain **segment** of possible input values.

**(2)**

This row, for example, expresses that _long time silver customers receive a 9% discount_.

Such a use case fits to the hit policy "**Unique**". For such use cases, it is an advantage that this hit policy make your decision logic invalid in case you violate its requirement that your table rules never "overlap": after all, you must not produce ambiguous results.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
