# Process instance creation — Run process segment

The [`create and execute asynchronously`](#create-and-execute-asynchronously) and [`create and await results`](#create-and-await-results) commands both start the process instance at their default initial element: the single [none start event](https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events#none-start-events). Camunda 8 also provides a way to create a process instance starting or ending at user-defined element(s).

**Info**
This is an advanced feature. Camunda recommends to only use this functionality for testing purposes. The none start event is the defined beginning of your process. Most likely the process is modeled with the intent to start all instances from the beginning.

#### Start instructions

To start the process instance at a user-defined element, you need to provide start instructions along with the command. Each instruction describes how and where to start a single element.

By default, the instruction starts before the given element. This means input mappings of that element are applied as usual.

Multiple instructions can be provided to start the process instance at more than one element.
You can activate the same element multiple times inside the created process instance by referring to the same element ID in more than one instruction.

#### Runtime instructions

By default, the process execution continues normally until the end of the process. To change this behavior and end the process instance after a specific element completes or terminates, provide runtime instructions. Each runtime instruction specifies the ID of one element whose completion or termination ends the process instance.

You can provide multiple runtime instructions to terminate the process instance after multiple elements—for example, when a process has multiple parallel flows.

**Note**
Start and runtime instructions have the same [limitations as process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification#limitations), e.g., it is not possible to start or end at a sequence flow.

Start and runtime instructions are supported for both `CreateProcessInstance` commands. Both instruction sets can be used separately or together to achieve different scenarios.

   Create a process instance with a start and a runtime instruction
   

The example below shows how to create a process instance that starts at a user-defined element and terminates after it, so that only the specified segment of the process is executed.

```
curl -L 'http://localhost:8080/v2/process-instances' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "processDefinitionId": "order-process”,
  "processDefinitionVersion": -1,
  "startInstructions": [
    {
      "elementId": "ship_parcel"
    }
  ],
  "runtimeInstructions": [
    {
      "type": "TERMINATE_PROCESS_INSTANCE",
      "afterElementId": "ship_parcel"
    }
  ]
  "variables": { "orderId": "1234" }
}'
```

See the [API reference for process instance creation](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-process-instance.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
