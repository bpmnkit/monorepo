# Message aggregation — Best practices

- Always include a unique `correlationKey` in message variables and BPMN definition.
- Use a **timer boundary event** to avoid waiting indefinitely for missing messages.
- Add logging or audit tasks for tracking message count and correlation.
- If using multiple sources, validate messages before appending to the collection.
- Test with different message arrival orders to ensure correct behavior.


## Related resources

- [Messages](https://docs.camunda.io/docs/next/components/concepts/messages)

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation
