# Dealing with problems and exceptions — Handling errors on the process level — Business vs. technical errors

Note that you have two different ways of dealing with problems at your disposal now:

- **Retrying**. You don't want to model the retrying, as you would have to add it to each and every service task. This will bloat the visual model and confuse business personnel. Instead, either retry or fall back to incidents as described above. This is hidden in the visual.
- Branch out **separate paths**, as described with the error event.

In this context, we found the terms **business error** and **technical error** can be confusing, as they emphasize the source of the error too much. This can lead to long discussions about whether a certain problem is technical or not, and if you are allowed to observe technical errors in a business process model.

It's much more important to look at how you react to certain errors. Even a technical problem can qualify for a business reaction. In the above example, upon technical problems with the invoice service you can decide to manually send the invoice (business reaction) or to retry until the invoice service becomes available again (technical reaction).

Or, for example, you could decide to continue a process in the event that a scoring service is not available, and simply give every customer a good rating instead of blocking progress. The error is clearly technical, but the reaction is a business decision.

In general, we recommend talking about business reactions, which are modeled in your process, and technical reactions, which are handled generically using retries or incidents.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
