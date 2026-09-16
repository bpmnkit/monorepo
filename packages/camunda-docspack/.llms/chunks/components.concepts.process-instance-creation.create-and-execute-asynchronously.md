# Process instance creation — Create and execute asynchronously

A process that has a [none start event](https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events#none-start-events) is started explicitly using **[CreateProcessInstance](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#createprocessinstance-rpc)**.

This command creates a new process instance and immediately responds with the process instance ID. The execution of the process occurs after the response is sent.

![create-process](assets/create-process.png)

   Create a process instance via Orchestration Cluster REST API
   

```
curl -L 'http://localhost:8080/v2/process-instances' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "processDefinitionKey": "2251799813685249”,
  "processDefinitionVersion": 1
}'
```

Response:

```
{
  "processDefinitionId": "order-process",
  "processDefinitionVersion": 1,
  "processDefinitionKey": "2251799813685249",
  "processInstanceKey": "2251799813686019"
}
```

See the [API reference for process instance creation](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-process-instance.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
