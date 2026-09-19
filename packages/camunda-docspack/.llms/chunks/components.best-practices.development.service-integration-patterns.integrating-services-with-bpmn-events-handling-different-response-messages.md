# Service integration patterns with BPMN — Integrating services with BPMN events — Handling different response messages

Very often the response payload of the message will be examined to determine how to move on in the process.

![Gateway handling response](service-integration-patterns-assets/response-gateway.png)

In this case, you receive exactly one type of message for the response. As an alternative, you could also use different message types, to which the process can react differently. For example, you might wait for the validation message, but also accept a cancellation or rejection message instead:

![Boundary message event to capture different response messages](service-integration-patterns-assets/response-boundary-message-events.png)

This modeling has the advantage that it is much easier to note the expected flow of the process (also called the happy path), with exceptions deviating from it. On the other hand, this pattern mixes receive tasks and events in one model, which can confuse readers. Keep in mind that it only works for a limited number of non-happy messages.

To avoid the task/event mixture you could use a so-called event-based gateway instead, this gateway waits for one of a list of possible message types to be received:

![Event based gateway to capture different response messages](service-integration-patterns-assets/response-event-based-gateway.png)

We typically try to avoid the event-based gateway, as it is hard to understand for non-BPMN professionals. At the same time, it shares the downside of the first pattern with the decision gateway after the receive task: the happy path cannot be easily spotted.

As a fourth possibility, you can add event subprocesses, which get activated whenever some event is received while the process is still active in some other area. In the above example, you could model the happy path and model all deviations as event subprocesses.

![Event subprocess to capture different response messages](service-integration-patterns-assets/response-event-subprocess.png)

This pattern is pretty handy, but also needs some explanation to people new to BPMN. It has one downside you need to know: once your process instance moves to the subprocess, you can’t easily go back to the typical flow. To some extent this problem can be solved by advanced modeling patterns like shown in the [allow for order cancellation anytime](https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models#allow-for-order-cancellation-any-time) example.

At the same time, the event subprocess has a superpower worth mentioning: you can now wait for cancellation messages in whole chunks of your process — it could arrive anytime.

|                   | Receive task with boundary events                                                                     | Payload and XOR-gateway                                                                   | Event-based gateway                                                                          | Event subprocess                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
|                   | ![Boundary Events](service-integration-patterns-assets/response-boundary-message-events.png)          | ![XOR Gateway](service-integration-patterns-assets/response-gateway.png)                  | ![Event-based Gateway](service-integration-patterns-assets/response-event-based-gateway.png) | ![Event Subprocess](service-integration-patterns-assets/response-event-subprocess.png) |
| Understandability | Easy                                                                                                  | Very easy                                                                                 | Hard                                                                                         | Medium                                                                                 |
| Assessment        | Limitation on how many message types are possible                                                     | Happy path not easily visible                                                             |                                                                                              | Might need some explanation for readers of the model                                   |
| Recommendation    | Use when it is important to observe message types in the visual, limit to two boundary message events | Use when there are more response types or if the response type can be treated as a result | Try to avoid                                                                                 | Use if you need bigger scopes where you can react to events                            |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
