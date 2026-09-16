# Exclusive gateway — Conditions

A `conditionExpression` defines when a flow is taken. It is a [boolean expression](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions) that can access the process variables and compare them with literals or other variables. The condition is fulfilled when the expression returns `true`.

Multiple boolean values or comparisons can be combined as disjunction (`or`) or conjunction (`and`).

For example:

```feel
= totalPrice > 100

= order.customer = "Paul"

= orderCount > 15 or totalPrice > 50

= valid and orderCount > 0
```


## Additional resources

### XML representation

An exclusive gateway with two outgoing sequence flows:

```xml
<bpmn:exclusiveGateway id="exclusiveGateway" default="else" />

<bpmn:sequenceFlow id="priceGreaterThan100" name="totalPrice &#62; 100"
  sourceRef="exclusiveGateway" targetRef="shipParcelWithInsurance">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">
    = totalPrice &gt; 100
  </bpmn:conditionExpression>
</bpmn:sequenceFlow>

<bpmn:sequenceFlow id="else" name="else"
  sourceRef="exclusiveGateway" targetRef="shipParcel" />
```

### References

- [Expressions](https://docs.camunda.io/docs/next/components/concepts/expressions)
- [Incidents](https://docs.camunda.io/docs/next/components/concepts/incidents)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/exclusive-gateways/exclusive-gateways
