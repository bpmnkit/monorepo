# Error events — Throwing the error

An error can be thrown within the process using an error **end event**.

![process with error throw event](assets/error-throw-events.png)

Alternatively, you can inform Zeebe that a business error occurred using a **client command**. This throw error client
command can only be used while processing a job.

In addition to throwing the error, this also disables the job and stops it from being activated or completed by other job workers. Refer to the [gRPC command](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#throwerror-rpc) and [REST request](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/throw-job-error.api) for details.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
