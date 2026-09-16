# Get started with cluster variables — Step 2: Override for a specific tenant

Now, create a tenant-specific override for your development environment. This allows you to use the same BPMN process in both environments without modifications.

Replace `{tenantId}` with your actual tenant ID (for example, `dev-environment`):

```bash
POST /v2/cluster-variables/tenant/{tenantId}
Content-Type: application/json

{
  "name": "PAYMENT_API_CONFIG",
  "value": {
    "endpoint": "https://api.payment.dev.example.com",
    "timeout_ms": 30000,
    "retry_count": 1
  }
}
```

**Note**
Processes running in the `dev-environment` tenant automatically use the development API configuration, while all other tenants use the production configuration.


## Step 3: Access the variable in Modeler

Open Camunda Modeler and create or open a BPMN process. Add a service task to your process that calls the payment API.

To use your cluster variable in a service task:

1. Select the service task in your diagram.
2. In the properties panel, navigate to the **Inputs** section.
3. Add an input mapping.
4. For the **Variable assignment value** field, enter the following FEEL expression to access the API endpoint:

```
= camunda.vars.env.PAYMENT_API_CONFIG.endpoint
```

5. For the **Local variable name** field, enter `apiUrl`. This creates a local variable for your service task.
6. Add another input mapping for the timeout using the following expression:

```
= camunda.vars.env.PAYMENT_API_CONFIG.timeout_ms
```

7. Set the local variable name to `timeoutMs`.

Your service task now has access to both the `apiUrl` and `timeoutMs` variables, which automatically resolve to the correct values based on whether the process runs in your production cluster or the development tenant.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/get-started
