# Get started with cluster variables — Step 4: Deploy and test your process

1. Complete your BPMN diagram by adding any additional tasks and an end event.
2. Click **Deploy** to deploy your process to the cluster.
3. Create a process instance by clicking **Run** (or start it via API).
4. Navigate to Operate to view your process instance.
5. Inspect the process variables to see that the cluster variables were resolved correctly based on your tenant context.

**What happens during execution**

- If the process runs in the `dev-environment` tenant, it uses the development API endpoint (`https://api.payment.dev.example.com`) with a 30-second timeout.
- If the process runs in any other context, it uses the production API endpoint (`https://api.payment.prod.example.com`) with a five-second timeout.
- The BPMN file remains identical across all environments.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/get-started
