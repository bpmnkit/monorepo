# @bpmnkit/api — Process Operations

```typescript
// Deploy
const deployed = await client.process.deploy({
  resources: [{ content: bpmnXml, name: "my-flow.bpmn" }],
});

// Start instance
const instance = await client.process.startInstance({
  bpmnProcessId: "my-flow",
  variables: { customerId: "cust-001" },
});

// List active instances
const { items } = await client.process.listInstances({
  state: "ACTIVE",
  bpmnProcessId: "my-flow",
});

// Cancel instance
await client.process.cancel({
  processInstanceKey: instance.processInstanceKey,
});
```


## Job Workers

```typescript
// Activate and handle jobs in a poll loop
const worker = await client.jobs.activateAndProcess({
  type: "send-email",
  maxJobsToActivate: 10,
  timeout: 60_000,          // job lock duration in ms
  worker: "email-worker-1",

  handler: async (job) => {
    try {
      await sendEmail(job.variables);
      await client.jobs.complete({
        jobKey: job.key,
        variables: { emailSent: true },
      });
    } catch (err) {
      await client.jobs.fail({
        jobKey: job.key,
        errorMessage: String(err),
        retries: job.retries - 1,
      });
    }
  },
});

// Stop polling
worker.close();
```

---
Source: https://bpmnkit.com/docs/packages/api
