# Messages — Message patterns

The following patterns describe solutions for common problems that can be solved using message correlation.

### Message aggregator

**Problem**: Aggregate/collect multiple messages, map-reduce, batching

**Solution**:

![Message Aggregator](assets/message-aggregator.png)

The messages are published with a `TTL > 0` and a correlation key that groups the messages per entity.

The first message creates a new process instance. The following messages are correlated to the same process instance if they have the same correlation key.

When the instance ends and messages with the same correlation key are not correlated yet, a new process instance is created.

**Note**
You may also use TTL to wait for messages that may arrive earlier when combining [start events and intermediate catch events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events).

Learn more in our [message aggregation guide](https://docs.camunda.io/docs/next/components/concepts/message-aggregation).

### Single instance

**Problem**: Create exactly one instance of a process

**Solution**:

![Message Single Instance](assets/message-single-instance.png)

The message is published with a `TTL = 0` and a correlation key that identifies the entity.

The first message creates a new process instance. The following messages are discarded and do not create a new instance if they have the same correlation key and the created process instance is still active.

### Request-reply with unique correlation key

**Problem**: An [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) or service sends a message to an external system (for example, a chat platform or webhook) and waits for a reply. Multiple process instances may be active concurrently, each waiting for its own reply.

**Solution**:

Generate a unique correlation key when the outbound message is sent, pass it to the external system, and subscribe with the same key in the reply catch event.

This avoids the [duplicate subscription problem](#duplicate-subscriptions) that occurs when all instances share the same correlation key (for example, a static user ID or a fixed string).

A common implementation:

1. A service task sends the outbound message and generates a unique key (for example, `chatId + "-" + uuid()`).
2. The external system receives both the message content and the correlation key.
3. When the external system replies, it includes the correlation key.
4. A message catch event subscribes using the same key, so the reply reaches the correct instance.

**Note**
This pattern is the recommended approach for any send-and-wait interaction where process instances can run concurrently.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
