# Handling data in processes — Understanding data handling in Camunda

When reading and interpreting a business process diagram, you quickly realize there is always data necessary for tasks, but also to drive the process through gateways to the correct next steps.

Examine the following tweet approval process example:

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

**(1)**

The process instance starts with a freshly written `tweet` we need to remember.

**(2)**

We need to present this `tweet` so that the user can decide whether to `approve` it.

**(3)**

The gateway needs to have access to this information: was the tweet `approved`?

**(4)**

To publish the tweet, the service task again needs the `tweet` itself!

Therefore, the tweet approval process needs two variables:

| Variable name | Variable type | Sample value     |
| ------------- | ------------- | ---------------- |
| `tweet`       | String        | "@Camunda rocks" |
| `approved`    | Boolean       | true             |

In Camunda 8, [values are stored as JSON](https://docs.camunda.io/docs/next/components/concepts/variables#variable-values).

**Caution: Camunda 7 handles variables slightly differently**
This best practice describes variable handling within Camunda 8. Process variables are handled slightly differently with Camunda 7. Consult the [Camunda 7 documentation](https://docs.camunda.org/manual/latest/user-guide/process-engine/variables/) for details. In essence, variable values are not handled as JSON and thus there are [different values](https://docs.camunda.org/manual/latest/user-guide/process-engine/variables/#supported-variable-values) supported.

You can dynamically create such variables by assigning an object of choice to a (string typed) variable name; for example, by passing a `Map<String, Object>` when [completing](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/complete-user-task.api) the "Review tweet" task via the API:

```
// TODO: Double check!
completeTask(
    taskId: "547811"
    variables: [
        {
            name: "approved"
            value: true
        }
    ]
)
```

In Camunda, you do _not_ declare process variables in the process model. This allows for a lot of flexibility. Refer to recommendations below on how to overcome possible disadvantages of this approach.

Consult the [docs about variables](https://docs.camunda.io/docs/next/components/concepts/variables#variable-values) to learn more.

Camunda does not treat BPMN **data objects** () as process variables. We recommend using them occasionally _for documentation_, but you need to [avoid excessive usage of data objects](https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models#avoiding-excessive-usage-of-data-objects).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes
