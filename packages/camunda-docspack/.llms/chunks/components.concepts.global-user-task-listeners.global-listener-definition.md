# Global user task listeners — Global listener definition

Each listener is defined by the following properties:

| Property         | Required               | Description                                                                                                                                                                                                                                                     |
| :--------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | Yes                    | User-provided unique identifier for the listener. This identifier is used to interact with the global listener through API                                                                                                                                      |
| `eventTypes`     | Yes                    | List of user task event types that trigger the listener.Supported values: `creating`, `assigning`, `updating`, `completing`, `canceling`.The shorthand `all` value is also available if the listener should react to all lifecycle events. |
| `type`           | Yes                    | The name of the job type.Used as a reference to specify which job workers request the respective task listener job. For example, `order-items`.                                                                                                   |
| `retries`        | No                     | Number of retries for the user task listener job. Defaults to `3` if not set.                                                                                                                                                                                   |
| `afterNonGlobal` | No                     | Boolean indicating whether the listener should run after model-level listeners. Defaults to `false` (runs before model-level listeners).                                                                                                                        |
| `priority`       | No                     | The priority of the listener. Higher priority listeners are executed before lower priority ones. It must be an integer between 0 and 100. Defaults to `50` if not set.                                                                                          |
| `source`         | No (automatically set) | Indicates how the listener was defined, either through configuration or API.Supported values: `CONFIGURATION` and `API`.This property is automatically set by the system and cannot be modified by users.                                  |

You have to use a different `id` for each configured listener, since this property is used to uniquely identify the listener and interact with it through the Orchestration Cluster API, for example, to update or delete the listener.

You can use the same `type` value for multiple listeners if they should be handled by the same job workers.

The `source` property only distinguishes how the listener was defined, but it has no practical effect in how the global listeners are executed.

You can configure global user task listeners in multiple ways, as described in [configure global user task listeners](https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/configuration):

- Through the Unified Configuration.
- Via the Orchestration Cluster API.
- Via the Admin UI.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners
