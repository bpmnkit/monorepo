# Choosing the DMN hit policy — Understanding DMN hit policy use cases — Sum: accepting a customer based on soft criteria

Hit policy "collect" may be combined with operators such as **Sum (C+)**, leading to very different use cases. A very typical one is the requirement to evaluate a case based on manyfold factors influencing the overall result.

Assume, for example, that we want to deal with customers we know nothing about. They receive a score of 0. But in case we know something about them, we also weigh in our knowledge:

**(1)**

The overall creditworthiness is deducted by throwing in many factors.

**(2)**

Here, for example, we give credit in case we made good experiences with the customer in the past.

**(3)**

A very low current income does not matter as long as the customer is not a stranger to us!

**(4)**

On the other hand, as soon as a customer has proof for a good income, they receive five points for "reasonable" income as well as 10 points extra for good income.

Even if we had bad experience with a customer (which means they start from -15), we end up with an overall score of 0 in case the customer has a good income now, and start to accept the customer again.

In scenarions dealing with **soft exclusion** and **inclusion** criteria, we need a mechanism to associate a weight to different scenarios. This is ideally supported by hit policy **Sum (C+)**.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
