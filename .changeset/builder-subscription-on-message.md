---
"@bpmnkit/core": minor
---

The process builders now write a message catch's `zeebe:subscription` (its `correlationKey`) on the `bpmn:message` it refers to, where Zeebe reads it and where its schema allows it, instead of on the receive task, intermediate catch event or boundary event. Camunda's own linter rejects the old placement. Generated XML for models built with a `correlationKey` changes accordingly, which moves their `semanticHash`; released as a minor by decision of the maintainer, since the old output did not match Camunda's schema. If one message is used with two different correlation keys, which Zeebe cannot express, both subscriptions stay on their elements and lint reports them.
