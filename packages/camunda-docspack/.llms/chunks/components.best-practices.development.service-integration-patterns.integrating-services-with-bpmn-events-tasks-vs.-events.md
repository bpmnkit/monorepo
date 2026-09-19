# Service integration patterns with BPMN — Integrating services with BPMN events — Tasks vs. events

The **execution semantics of send and receive events is identical with send and receive tasks**, so you can express the very same thing with tasks or events.

However, there is one small difference that might be relevant: **only tasks can have boundary events**, which allows to easily model when you want to cancel waiting for a message:

![Boundary events](service-integration-patterns-assets/boundary-event.png)

Despite this, the whole visual representation is of course different. In general, tasks are easier understood by most stakeholders, as they are used very often in BPMN models.

However, in certain contexts, such as event-driven architectures, events might be better suited as the concept of events is very common. Especially, if you apply domain-driven design (DDD) and discuss domain events all day long, it might be intuitive that events are clearly visible in your BPMN models.

Another situation better suited for events is if you send events to your internal reporting system besides doing “the real” business logic. Our experience shows that the smaller event symbols are often unconsciously treated as less important by readers of the model, leading to models that are easier to understand.

|                | Send task                | Receive task             | Send event                                                                                                              | Receive event                                                                                                           |
| :------------- | :----------------------- | :----------------------- | :---------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| Recommendation | Prefer tasks over events | Prefer tasks over events | Use only if you consistently use events over tasks and have a good reason for doing so (e.g. event-driven architecture) | Use only if you consistently use events over tasks and have a good reason for doing so (e.g. event-driven architecture) |

**Note**
The choice about events vs. commands also [needs to be reflected in the naming of the element](https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements), as a task emphasizes the action (e.g. "wait for response") and the event reflects what happened (e.g. "response received").

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
