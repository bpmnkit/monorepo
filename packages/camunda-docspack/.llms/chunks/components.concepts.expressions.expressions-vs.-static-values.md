# Expressions — Expressions vs. static values

Some attributes of BPMN elements, like the timer definition of a timer catch event, can be defined in one of two ways:

- As an expression (e.g. `= remainingTime`)
- As a static value (e.g. `PT2H`)

Expressions always start with an **equals sign** (**=**). For example, `= order.amount > 100`. The text following the equal sign is the actual expression. For example, `order.amount > 100` checks if the amount of the order is greater than 100.

If the element does not start with the prefix, it is used as a static value. A static value is used either as a string (e.g. job type) or as a number (e.g. job retries). A string value must not be enclosed in quotes.

**Note**
An expression can also define a static value by using literals (e.g. `= "foo"`, `= 21`, `= true`, `= [1,2,3]`, `= {x: 22}`, etc.)

---
Source: https://docs.camunda.io/docs/next/components/concepts/expressions
