# Choosing the DMN hit policy — Knowing the DMN hit policy basics

A decision table consists of several **rules**, typically represented as rows. When reading such a row, we look at certain **input values** and deduct a certain result represented by **output values**. When using the simplest hit policy **"unique"** (**U**), such rules do **not overlap**: only a single rule must match.

**(1)**

We define an "input" value **season** here. For every single season ...

**(2)**

... there is a **jacket** defined we want to use, the "output" of the rules here.

**(3)**

The hit policy "**Unique**" (indicated by the character **U**) enforces that rules do **not overlap**: only a single rule must match.

Now consider that we build a decision table with **overlapping rules**. In other words, that means more than one rule may match a given set of input values. We then need one of the **alternative hit policy** indicators to unambiguously understand the decision logic according to which such rules are interpreted.

The hit policy **indicator** is a single character shown in the decision table's top left cell, right beneath the decision's name. The character is the initial letter of one of the defined seven hit policies `U`**nique**, `A`**ny**, `P`**riority**, `F`**irst**, `C`**ollect**, `O`**utput order** and `R`**ule order**. Furthermore, the hit policy 'Collect' may also be used with one of four aggregation operators, actually giving us four more hit policies `C+` (**Sum**), `C<` (**Minimum**), `C<` (**Maximum**) and `C#` (**Number**).

Eight of those eleven hit policies evaluate a decision table to a **single result**. Three hit policies evaluate a decision table to **multiple results**.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
