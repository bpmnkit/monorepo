# Conditionals — Conditional event triggers — On variable changes

In addition to scope activation, conditional events can also be triggered when relevant variables change within the event’s visible scope.
When a variable changes (for example, it is created or updated), the engine evaluates the condition for any active conditional events in the variable's scope and all child scopes whose condition depends on that variable (see [top-down evaluation](#top-down-evaluation)).

Given the following process definition:

An event sub-process with a conditional start event is defined with condition `x > 10`. Assume the process instance starts with variable `x` initialized to `5`. The main process starts and executes the service task, while the event sub-process is not triggered because the condition is not satisfied.
If the process instance updates variable `x` to `11` (for example, via the [update element instance variables API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-element-instance-variables.api)), the engine evaluates the condition for the conditional start event in the event sub-process. Since the condition is now `true`, the conditional start event triggers and the event sub-process starts.

#### Top-down evaluation

When a variable changes, the engine evaluates conditions in a top-down order based on scopes. Starting from the scope where the variable changed, the engine evaluates conditions for any active conditional events in that scope. It then evaluates conditions in child scopes, continuing down the hierarchy. This continues until a triggered event interrupts one of the scopes or there are no more child scopes to evaluate.

Given the following process definition:

If a variable is set within the scope of the root process instance or sub-process instance, the engine evaluates the sub-process’s conditional boundary event first. If the condition is satisfied, execution is interrupted; otherwise, the engine evaluates the conditional boundary event on the inner service task A and triggers it if its condition is satisfied.

#### Scope isolation

A variable change can trigger only the conditional events that can see that variable in the current scope or one of its child scopes. Unrelated scope instances are not affected.

Given the following process definition:

Service task A and service task B are active in parallel branches of the process. If a variable is set in the sub-process instance, then only the conditional boundary event on service task A is evaluated. The boundary event on service task B cannot trigger because the variable is not visible in its scope. See [variable scopes](https://docs.camunda.io/docs/next/components/concepts/variables#variable-scopes) for more details on variable visibility rules.

#### Expression-based evaluation

When a conditional event is activated, the engine analyzes its FEEL condition and derives which variables the expression depends on.
The subscription is re-evaluated only when one of those referenced variables changes within the event’s visible scope.

The following rules apply to condition expressions:

- Condition `x > 1` is re-evaluated only when variable `x` changes.
- Condition `x > 1 and y < 5` is re-evaluated when either variable `x` or variable `y` changes.
- Condition `x.y.z = true` is re-evaluated when variable `x` changes, because the expression depends on the value of `x` (even if it accesses a property of `x`).

**Warning**
Use plain FEEL expressions instead of nested variable access (for example, `x > 1` instead of `x.value > 1`).
This helps the engine derive variable dependencies correctly and re-evaluate the condition when relevant variables change.
If you use nested variable access, the engine treats the entire variable as a dependency.
For example, if the condition is `x.value > 1`, the engine treats `x` as a dependency.
The condition is re-evaluated every time `x` changes, even if the change does not affect `value`.
This can lead to unintended triggers for non-interrupting conditional events if variable `x` is updated frequently.

---
Source: https://docs.camunda.io/docs/next/components/concepts/conditionals
