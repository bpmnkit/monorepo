# Outbound connectors vs. job workers — Delivery

A connector is reusable code, written as an `OutboundConnectorFunction` using the [Connector SDK](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/connector-sdk#outbound-connector-runtime-logic).
It is not a standalone application, you cannot start it and have it work on Camunda 8 jobs.
Instead, a connector is delivered as a library and can be used in combination with other connectors in a [Connector runtime environment](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/connector-sdk#runtime-environments).

In contrast, a job worker is usually part of a Zeebe client application that can be directly executed to work on jobs.


## Reusability

A job worker usually runs as or inside a standalone Zeebe client. Without effort, you cannot simply run this in Camunda 8 SaaS or any other environment.
As a Self-Managed user, you can run it standalone, but often not directly reuse the logic in your existing Zeebe client that you might already have.
You can manually extract the job handler from the given job worker, but you also have to ensure that it is still working as expected afterward.

In contrast, a connector itself is environment-agnostic. There is a runtime environment for Camunda 8 SaaS that can wrap and call this connector. As the connector developer, you don't have to worry about this as the runtime takes care of it if you developed the connector using the Connector SDK.

You can also run the exact same connector (without any modification) in Camunda 8 Self-Managed; either as a standalone job worker, as additional job handler in your existing Zeebe client application, or together with other connectors in one Zeebe client application.
This all comes with the Connector SDK, and there is no additional code necessary to get started. However, if you need a custom environment, the Connector SDK provides a guide and default helpers to do that.

---
Source: https://docs.camunda.io/docs/next/components/concepts/outbound-connectors-job-workers
