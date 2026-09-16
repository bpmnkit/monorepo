# Message events — Message boundary events

An activity can have one or more message boundary events. Each of the message events must have a unique message name.

When the activity is entered, it creates a corresponding message subscription for each boundary message event. If a non-interrupting boundary event is triggered, the activity is not terminated and multiple messages can be correlated.

The `correlationKey` expression of a message boundary event is evaluated in the activity's own (element instance) scope, consistent with the timer duration, message name, and signal name expressions of boundary events. This means the expression can access variables introduced by input mappings on the activity the boundary event is attached to. If the expression fails to evaluate, the resulting incident is raised on the activity itself, not on its flow scope. This behavior is controlled by the `camunda.processing.evaluate-boundary-event-correlation-key-in-activity-scope` property, which requires a broker restart to take effect. It defaults to `true` in Camunda 8.10 and later. It's also available since Camunda 8.9, where it defaults to `false`.

**Note**
Set `camunda.processing.evaluate-boundary-event-correlation-key-in-activity-scope` to `false` to restore the previous behavior, where the expression is evaluated in the flow scope instead. The legacy `zeebe.broker.experimental.features.evaluateBoundaryEventCorrelationKeyInActivityScope` property (or its environment variable equivalents `CAMUNDA_PROCESSING_EVALUATEBOUNDARYEVENTCORRELATIONKEYINACTIVITYSCOPE` and `ZEEBE_BROKER_EXPERIMENTAL_FEATURES_EVALUATEBOUNDARYEVENTCORRELATIONKEYINACTIVITYSCOPE`) has the same effect.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
