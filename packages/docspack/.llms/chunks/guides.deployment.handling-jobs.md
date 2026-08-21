# Camunda 8 Deployment — Handling Jobs

Register a long-poll job worker to process service tasks:

```typescript
const subscription = await client.jobs.activateAndProcess({
  type: "send-email",
  maxJobsToActivate: 5,
  timeout: 30_000,
  worker: "email-service",

  handler: async (job) => {
    const { to, subject, body } = job.variables;

    await sendEmail({ to, subject, body });

    await client.jobs.complete({
      jobKey: job.key,
      variables: { sent: true, sentAt: new Date().toISOString() },
    });
  },
});

// Stop the worker
subscription.close();
```


## Querying Instances

```typescript
// List running instances
const instances = await client.process.listInstances({
  bpmnProcessId: "invoice-approval",
  state: "ACTIVE",
});

// Get a specific instance
const instance = await client.process.getInstance({
  processInstanceKey: "2251799813685249",
});

// Get variables
const variables = await client.variables.list({
  processInstanceKey: instance.key,
});
```

---
Source: https://docs.bpmnkit.com/guides/deployment/
