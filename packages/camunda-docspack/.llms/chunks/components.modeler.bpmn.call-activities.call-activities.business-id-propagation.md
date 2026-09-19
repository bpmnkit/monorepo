# Call activities — Business ID propagation

When a parent process instance has a business ID, child instances created by call activities inherit it by default. Starting in 8.10, you can configure each call activity to override this behavior.

### Default behavior

If no `businessId` configuration is set on the call activity, the child instance inherits the parent's business ID automatically. This is the 8.9 default. Existing models are unaffected.

### Override with a literal value or FEEL expression

To set a different business ID on the child instance, configure the `businessId` attribute on the `zeebe:calledElement` extension element. The value is resolved once at child creation and is then immutable.

```xml
<bpmn:callActivity id="Call_Activity" name="Call Process A">
  <bpmn:extensionElements>
    <zeebe:calledElement processId="child-process"
                         businessId="= camunda.processInstance.businessId" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

You can use the FEEL expression context variable `camunda.processInstance.businessId` to reference the parent instance's business ID in the expression.

| Configuration                           | Effect                                                                                             |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------- |
| Attribute absent                        | Child inherits the parent's business ID (default).                                                 |
| Literal string                          | Child is created with that exact string as its business ID.                                        |
| FEEL expression (prefixed with `=`)     | Child gets the evaluated result. Access the parent's ID with `camunda.processInstance.businessId`. |
| Empty string `""` or expression `=null` | Child starts with no business ID. No incident is raised.                                           |

### Validation and error handling

Business ID values go through two validation stages:

**Danger: Deploy-time rejection**
The process cannot be deployed if:

- The `businessId` attribute contains an invalid FEEL expression syntax.
- A static literal value exceeds 256 characters.

If the value is empty or intentionally `null` at runtime (for example, `=null` or a FEEL expression that cleanly evaluates to `null`), the child starts with no business ID and no incident is raised.

**Warning: Runtime incident (resolvable)**
An incident is raised on the call activity if the FEEL expression:

- Evaluates to `null` due to evaluation warnings — for example, a missing variable caused the null rather than an intentional `=null`.
- Evaluates to a string exceeding 256 characters.
- Evaluates to a non-string, non-null type (number, boolean, or list).

To resolve the incident: correct the variables or expression, then retry activation. The child instance is created with the corrected business ID.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities
