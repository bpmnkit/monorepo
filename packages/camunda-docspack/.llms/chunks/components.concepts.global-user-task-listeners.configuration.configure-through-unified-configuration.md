# Configure global user task listeners — Configure through Unified Configuration

Configure global user task listeners through [Unified Configuration](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#camundaclusterglobal-listeners) under `camunda.cluster.global-listeners.user-task`.

Each listener entry supports the properties in [global listener definition](https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners#global-listener-definition), except `source`, which is automatically set to `CONFIGURATION`. Any provided `source` value is ignored.

### How the configuration is validated

If configuration entries are invalid, the system rectifies them instead of failing startup.

The following validation rules are applied automatically on startup:

- If a listener is missing the required `id`, `type`, or `event-types` properties, it is removed.
- If a listener defines invalid event types, those event types are removed. If all event types are invalid, the listener is removed.
  - Valid event types are: `creating`, `assigning`, `updating`, `completing`, `canceling`, or the special value `all`. Event type matching is case-insensitive, so `Creating` and `creating` are both valid, but `create` is not.
- If a listener defines duplicate event types, the duplicates are removed and only one instance of each event type is kept.
- If a listener defines both the special `all` value and a normal event type for `event-types`, the configuration is corrected to include only `all`. This ensures the listener catches all events as intended.
- If a listener defines invalid retry values (non-numeric, negative, or zero), it is removed. Valid retry values are positive integers.
- If a listener defines an invalid `priority`, it is removed. Valid priorities are integers from `0` to `100`.

In all these cases, the Orchestration Cluster writes a startup warning that identifies the problem location. Invalid listeners are removed while valid listeners remain active.

**Note**
Listeners defined through the API are not subject to this validation.

### Example configuration

The following is an example YAML configuration and environment variables:

```yaml
camunda:
  cluster:
    global-listeners:
      user-task:
        - id: "validation-listener"
          type: "validate-task"
          event-types:
            - creating
          priority: 70
        - id: "audit-listener"
          type: "audit-generic"
          event-types: all
          retries: 5
          priority: 50
        - id: "notification-listener"
          type: "notify-assignee"
          event-types:
            - assigning
            - updating
            - canceling
          after-non-global: true
          priority: 30
```

```bash
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_0_ID=validation-listener
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_0_TYPE=validate-task
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_0_EVENT_TYPES_0=creating
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_0_PRIORITY=70
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_1_ID=audit-listener
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_1_TYPE=audit-generic
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_1_EVENT_TYPES_0=all
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_1_RETRIES=5
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_1_PRIORITY=50
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_ID=notification-listener
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_TYPE=notify-assignee
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_EVENT_TYPES_0=assigning
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_EVENT_TYPES_1=updating
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_EVENT_TYPES_2=canceling
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_AFTER_NON_GLOBAL=true
CAMUNDA_CLUSTER_GLOBAL_LISTENERS_USER_TASK_2_PRIORITY=30
```

### Apply changes

Configuration changes take effect after you restart the cluster. Use rolling restarts to avoid downtime.

After the restart, the new configuration applies to new lifecycle events for both running and new instances, without requiring you to redeploy models.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners/configuration
