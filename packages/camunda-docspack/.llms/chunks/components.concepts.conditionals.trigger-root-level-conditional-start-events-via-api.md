# Conditionals — Trigger root-level conditional start events via API

You can evaluate root-level conditional start events by using:

- The Orchestration Cluster REST API. See [evaluate root-level conditional start events](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/evaluate-conditionals.api).
- The [Zeebe Gateway](https://docs.camunda.io/docs/next/reference/glossary#zeebe-gateway) gRPC API. See [`EvaluateConditional` RPC](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#evaluateconditional-rpc).
- Client SDKs. For example, use `newEvaluateConditionalCommand()` in the Java client.

When you evaluate conditional start events:

- Multiple conditional start events in the same process definition can trigger if their conditions evaluate to `true`, which can start multiple process instances from the same definition.
- If you do not specify a `processDefinitionKey`, the engine evaluates all root-level conditional start events across all deployed process definitions and starts instances for those whose conditions evaluate to `true`.

These APIs apply only to root-level conditional start events.  
Conditional events inside running process instances are evaluated automatically when variables change.

### Migration from Camunda 7

In Camunda 7, conditional events use the `camunda:variableName` and `camunda:variableEvents` attributes.

In Camunda 8, the FEEL condition expression is the single source of truth for which variables can trigger the event.
The `camunda:variableName` attribute is not supported, so the engine derives variable dependencies directly from the FEEL expression.
During migration, `camunda:variableEvents` is converted into a `variableEvents` filter configuration where applicable.

Camunda 8 supports only `create` and `update`. If a model uses `delete` in Camunda 7, migration maps it to the closest supported behavior.

---
Source: https://docs.camunda.io/docs/next/components/concepts/conditionals
