# Variables — Variable scopes

Variable scopes define the _visibility_ of variables. The root scope is the process instance itself. Variables in this scope are visible everywhere in the process.

When the process instance enters a subprocess or an activity, a new scope is created. Activities in this scope can observe all variables of this and of higher scopes (i.e. parent scopes). However, activities outside of this scope can not observe the variables which are defined in this scope.

If a variable has the same name as a variable from a higher scope, it covers this variable. Activities in this scope observe only the value of this variable and not the one from the higher scope.

The scope of a variable is defined when the variable is created. By default, variables are created in the root scope.

![variable-scopes](assets/variable-scopes.png)

This process instance has the following variables:

- `a` and `b` are defined on the root scope and can be seen by **Task A**, **Task B**, and **Task C**.
- `c` is defined in the subprocess scope and can be seen by **Task A** and **Task B**.
- `b` is defined again on the activity scope of **Task A** and can be seen only by **Task A**. It covers the variable `b` from the root scope.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
