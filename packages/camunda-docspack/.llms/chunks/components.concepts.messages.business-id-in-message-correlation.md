# Messages — Business ID in message correlation

Starting in Camunda 8.10, you can include a business ID in message publication and correlation. Business ID acts as an additional filter constraint on top of the message name and correlation key.

### Supported combinations

Message name is always required. The following additional fields are supported per event type:

| Event type                                                       | Supported correlation fields                 |
| :--------------------------------------------------------------- | :------------------------------------------- |
| Start event                                                      | Message name                                 |
| Start event                                                      | Message name + business ID                   |
| Start event                                                      | Message name + correlation key               |
| Start event                                                      | Message name + correlation key + business ID |
| Non-start event (intermediate catch, boundary, event subprocess) | Message name + correlation key               |
| Non-start event                                                  | Message name + correlation key + business ID |

For non-start events, a business ID can only be used together with an existing correlation key. Business ID alone is not sufficient to correlate to a non-start subscription.

When both a correlation key and a business ID are provided, the message correlates only if both fields match the corresponding values stored on the subscription.

### Matching semantics

A business ID on a message is an optional narrowing filter, on top of — never a replacement for — the correlation key. Matching is asymmetric between the two sides:

| Message business ID | Subscription business ID | Correlates?                                      |
| :------------------ | :----------------------- | :----------------------------------------------- |
| Not set             | Not set                  | Yes — matches on name and correlation key alone. |
| Not set             | Set                      | Yes — the subscription's business ID is ignored. |
| Set                 | Not set                  | No.                                              |
| Set                 | Set, same value          | Yes.                                             |
| Set                 | Set, different value     | No.                                              |

A message subscription snapshots the process instance's business ID at the time the subscription is opened.

If a [late business ID assignment](https://docs.camunda.io/docs/next/components/concepts/process-instance-creation#late-business-id-assignment) updates a process instance after a subscription is already open, the existing subscription is not updated. Only subscriptions opened after the assignment carry the new business ID.

### Message-start buffering with uniqueness

When business ID uniqueness is enabled, a message-start event that would create a new instance with a business ID already held by an active instance is not dropped immediately. The message stays buffered and is retried until either:

- The active instance releases the business ID (by completing or terminating), or
- The message's TTL expires.

If the TTL expires before the business ID is released, the message is discarded without starting a new instance.

**Note**
`TTL = 0` (fire-and-forget) message-start events are not retried. They activate on first arrival only and are discarded immediately if blocked by uniqueness.

### API reference

- [Publish message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/publish-message.api) — `businessId` request field.
- [Correlate message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/correlate-message.api) — `businessId` request field.
- [Search correlated message subscriptions](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-correlated-message-subscriptions.api) — `businessId` as a filter and sort field.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
