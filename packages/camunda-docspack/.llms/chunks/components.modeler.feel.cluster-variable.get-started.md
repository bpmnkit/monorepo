# Get started with cluster variables

Get started with cluster variables by creating your first one and using it in a BPMN process.

Get started with cluster variables by creating your first one and using it in a BPMN process.

Throughout this tutorial, you'll build a payment processing workflow that calls different payment API endpoints depending on the environment.


## Step 1: Create a global cluster variable

First, create a global cluster variable that serves as your production API configuration. This variable is available to all processes across your cluster.

Use the Orchestration Cluster API to [create](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-global-cluster-variable.api) a global variable:

```bash
POST /v2/cluster-variables/global
Content-Type: application/json

{
  "name": "PAYMENT_API_CONFIG",
  "value": {
    "endpoint": "https://api.payment.prod.example.com",
    "timeout_ms": 5000,
    "retry_count": 3
  }
}
```

The API returns a confirmation response with your variable details.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/get-started
