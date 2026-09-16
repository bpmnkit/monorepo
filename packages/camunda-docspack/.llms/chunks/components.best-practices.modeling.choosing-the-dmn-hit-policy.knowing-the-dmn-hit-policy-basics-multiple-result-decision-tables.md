# Choosing the DMN hit policy — Knowing the DMN hit policy basics — Multiple result decision tables

**Multiple result** tables may return the output of multiple rules. The hit policies for such tables are:

- `C`**ollect**: All matching rules result in an arbitrarily ordered list of all the output entries.

- `R`**ule order**: All matching rules result in a list of outputs ordered by the sequence of those rules in the decision table.

- `O`**utput order**: All matching rules result in a list of outputs ordered by their (decreasing) output priority.

**Note**
Camunda does not yet support the hit policy **output order**. In essence, output orders are specified as an ordered list of output values in decreasing order of priority. Such priorities are therefore independent from rule sequence! Though not yet supported, you can mimic that behavior using hit policy "(**C**)ollect" and determining an output order yourself; for example, by means of an execution listener attached to the end of your business rule task.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
