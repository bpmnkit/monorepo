# Business rule tasks — Additional resources

### XML representation

A business rule task with a called decision that does not specify the binding type (`latest` is used implicitly):

```xml
<bpmn:businessRuleTask id="determine-box-size" name="Determine shipping box size">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="shipping_box_size" resultVariable="boxSize" />
  </bpmn:extensionElements>
</bpmn:businessRuleTask>
```

A business rule task with a called decision that uses the `deployment` binding type:

```xml
<bpmn:businessRuleTask id="determine-box-size" name="Determine shipping box size">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="shipping_box_size" bindingType="deployment"
                          resultVariable="boxSize" />
  </bpmn:extensionElements>
</bpmn:businessRuleTask>
```

A business rule task with a called decision that uses the `versionTag` binding type with a static version tag:

```xml
<bpmn:businessRuleTask id="determine-box-size" name="Determine shipping box size">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="shipping_box_size"
                          bindingType="versionTag" versionTag="v1.0"
                          resultVariable="boxSize" />
  </bpmn:extensionElements>
</bpmn:businessRuleTask>
```

A business rule task with a called decision that uses the `versionTag` binding type with expressions for both `decisionId` and `versionTag`:

```xml
<bpmn:businessRuleTask id="determine-box-size" name="Determine shipping box size">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="= \"shipping_box_size_\" + countryCode"
                          bindingType="versionTag" versionTag="= decisionVersion"
                          resultVariable="boxSize" />
  </bpmn:extensionElements>
</bpmn:businessRuleTask>
```

A business rule task with a job worker implementation and a custom header:

```xml
<bpmn:businessRuleTask id="calculate-risk" name="Calculate risk">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="calculate_risk" />
    <zeebe:taskHeaders>
      <zeebe:header key="decisionRef" value="risk" />
    </zeebe:taskHeaders>
    <zeebe:jobPriorityDefinition priority="90" />
  </bpmn:extensionElements>
</bpmn:businessRuleTask>
```

### References

- [DMN decision](https://docs.camunda.io/docs/next/components/modeler/dmn/dmn)
- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks
