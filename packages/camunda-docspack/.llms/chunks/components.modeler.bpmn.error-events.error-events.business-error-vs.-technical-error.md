# Error events — Business error vs. technical error

In real life, you’ll also have to deal with technical problems that you don't want to treat using error events.

Suppose the credit card service becomes temporarily unavailable. You don't want to model the retrying, as you would have to add it to each and every service task. This will bloat the visual model and confuse business personnel. Instead, either retry or fall back to incidents as described above. This is hidden in the visual.

In this context, we found the terms **business error** and **technical error** can be confusing, as they emphasize the source of the error too much. This can lead to long discussions about whether a certain problem is technical or not, and if you are allowed to observe technical errors in a business process model.

It's much more important to look at how you _react_ to certain errors. Even a technical problem can qualify for a business reaction. For example, you could decide to continue a process in the event that a scoring service is not available, and simply give every customer a good rating instead of blocking progress. The error is clearly technical, but the reaction is a business decision.

In general, we recommend talking about business reactions, which are modeled in your process, and technical reactions, which are handled generically using retries or incidents.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
