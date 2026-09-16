# Process instance creation — FEEL context variables — What is a business ID?

A business ID is a domain-specific identifier you can assign to a process instance. Unlike the system-generated process instance key, it represents a domain concept such as an order number, case reference, or customer ticket ID.

A business ID does **not need to be unique** unless uniqueness control is enabled. See [uniqueness control](#uniqueness-control) for details.

For example, consider a process that ships book orders where each order already has an identifier in your order management system. When you start the process to ship an order, you can use the order ID as the business ID. This lets you easily find all process instances related to a particular order.

You set the business ID at process instance creation time via the `businessId` field in the creation request. The business ID is **immutable**; once set, it cannot be changed or removed for the lifetime of the process instance. The maximum length for a business ID is **256 characters**.

Starting in 8.10, you can also set a business ID when starting a process instance from **Camunda Hub** or **Desktop Modeler**.

   Create a process instance with a business ID via Orchestration Cluster REST API
   

```
curl -L 'http://localhost:8080/v2/process-instances' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "processDefinitionId": "order-process",
  "processDefinitionVersion": 1,
  "businessId": "order-1234"
}'
```

See the [API reference for process instance creation](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-process-instance.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
