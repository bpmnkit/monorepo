# Modeling with situation patterns — Measuring key performance indicators (KPIs)

You want to measure specific aspects of your process execution performance along some indicators.

**Example:** A software developer involved in introducing Camunda gets curious about the business: "How many applications do we accept or decline per month, and how many do we need to review manually? How many are later accepted and declined? How much time do we spend for those manual work cases, and how long does the customer have to wait for an answer? I mean...do we focus on the meaningful cases...?"

When modeling a process, we should actually always add some information about important key performance indicators (KPIs) implicitly. For example, specifically [naming start and end events](https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements#naming-events) with the process state reached from a business perspective. Additionally, we might explicitly add additional business milestones or phases.

While the following section concentrates on the aspects of modeling KPIs, you might want to learn more about using them for [reporting about processes](https://docs.camunda.io/docs/next/components/best-practices/operations/reporting-about-processes) from a more technical perspective. For example, when being faced with the task to actually retrieve and present Camunda's historical data collected on the way of execution.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
