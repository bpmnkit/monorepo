# Conditional events — Define conditions and variable filters

### Condition expressions (FEEL)

Conditional events use a FEEL expression in the `bpmn:condition` element. The expression must evaluate to a boolean value (`true` or `false`).

For example:

```xml title="Conditional event definition with FEEL condition"
<bpmn:conditionalEventDefinition id="ConditionalEventDefinition_1">
  <bpmn:condition xsi:type="bpmn:tFormalExpression">
    = x > 1
  </bpmn:condition>
</bpmn:conditionalEventDefinition>
```

The engine evaluates the FEEL expression using variables available in the event’s scope and derives which variables can trigger the conditional event from the expression.
For details, see [expression-based evaluation](https://docs.camunda.io/docs/next/components/concepts/conditionals#expression-based-evaluation).

### Variable filters

Variable filters restrict when a conditional event is re-evaluated in response to variable changes for those referenced variables.

The `variableEvents` attribute applies only to conditional events inside running process instances. It does not apply to root-level conditional start events.

Define an event-type filter by adding a `zeebe:conditionalFilter` extension element:

```xml title="Conditional event with Zeebe variable filter"
<bpmn:conditionalEventDefinition id="ConditionalEventDefinition_1rp6yz6">
  <bpmn:condition xsi:type="bpmn:tFormalExpression">
    = x > 1
  </bpmn:condition>

  <bpmn:extensionElements>
    <zeebe:conditionalFilter
      variableEvents="create, update" />
  </bpmn:extensionElements>
</bpmn:conditionalEventDefinition>
```

The `zeebe:conditionalFilter` extension element supports:

- `variableEvents` specifies which variable events trigger evaluation. Supported values:
  - `create`
  - `update`
  - `create, update`

For runtime behavior and limitations of variable filters, see [variable filter semantics](https://docs.camunda.io/docs/next/components/concepts/conditionals#variable-filter-semantics).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events
