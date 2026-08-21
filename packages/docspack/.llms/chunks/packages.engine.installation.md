# @bpmnkit/engine — Installation

```sh
pnpm add @bpmnkit/engine
```


## API Reference

### `new Engine()`

Creates a new engine instance. Each instance has its own process registry and running instances.

### `engine.deploy(options)`

Deploys one or more process and decision definitions:

```typescript
await engine.deploy({
  bpmn: bpmnXmlString,         // required
  forms: [formSchemaJson],     // optional: Camunda form schemas
  decisions: [dmnXmlString],   // optional: DMN decision tables
});
```

### `engine.start(processId, variables?, options?)`

Starts a new process instance:

```typescript
const instance = engine.start("my-process", {
  orderId: "ord-123",
  amount: 99.99,
});
```

**`StartOptions`:**

```typescript
type StartOptions = {
  beforeComplete?: (elementId: string) => Promise<void>;
};
```

The `beforeComplete` hook fires after a task has been executed but before the process
advances. Use it to pause for step-by-step execution or to inspect state mid-run.

### `engine.registerJobWorker(type, handler)`

Register a synchronous or asynchronous handler for service tasks of a given type:

```typescript
engine.registerJobWorker("send-email", async (job) => {
  await mailer.send({
    to: job.variables.recipient,
    subject: job.variables.subject,
  });

  // Complete the job (advances the process)
  await job.complete({ sent: true });

  // Or fail it (retries depending on retry config)
  // await job.fail("SMTP connection refused");
});
```

### `engine.getDeployedProcesses()`

Returns metadata about all deployed process definitions:

```typescript
const processes = engine.getDeployedProcesses();
// [{ id: "my-process", name: "My Process", version: 1 }]
```

---
Source: https://docs.bpmnkit.com/packages/engine/
