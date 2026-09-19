# Choosing the DMN hit policy — Knowing the DMN hit policy basics — Single result decision tables

Such tables either return the output of only one rule or aggregate the output of many rules into one result. The hit policies to be considered are

- `U`**nique**: Rules do not overlap. Only a single rule can match.

- `F`**irst**: Rules are evaluated from top to bottom. Rules may overlap, but only the first match counts.

- `P`**riority**: Rule outputs are prioritized. Rules may overlap, but only the match with the highest output priority counts.

**Note**
Camunda does not yet support the hit policy **priority**. In essence, priorities are specified as an ordered list of output values in decreasing order of priority. Such priorities are therefore independent from rule sequence! Though not yet supported, you can mimic that behavior using hit policy "(**C**)ollect" and determining a priority yourself; for example, by means of an execution listener attached to the end of your business rule task.

- `A`**ny**: Multiple matching rules must not make a difference: all matching rules must lead to the same output.

**Collect** and **aggregate**: The output of all matching rules is aggregated by means of an operator:

- `C+`**Sum**: Add up all the matching rule's distinct outputs.
- `C<`**Minimum**: Take the smallest value of all the matching rule's outputs.
- `C>`**Maximum**: Take the largest value of all the matching rule's outputs.
- `C#`**Number**: Return the number of all the matching rule's distinct outputs.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
