# Message aggregation — Troubleshooting

| Problem                                     | Cause                                                       | Solution                                                            |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Every message starts a new process instance | Missing or mismatched `correlationKey` in message variables | Ensure all messages use the same correlation key and name           |
| Process never completes                     | The `count(messages)` condition is not met                  | Verify your condition and that messages are successfully correlated |
| Messages not correlated                     | TTL expired or wrong message name                           | Use a TTL > 0 and match the BPMN message name exactly               |
| Duplicate aggregation                       | The instance ended but more messages arrived                | This is expected — a new instance is started                        |

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation
