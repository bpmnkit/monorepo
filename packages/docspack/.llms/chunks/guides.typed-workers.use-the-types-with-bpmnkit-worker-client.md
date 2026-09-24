# Typed Workers — Use the types with `@bpmnkit/worker-client`

Give the `JobTypes` map to `createWorkerClient`. The client then types each job by its job type:

```ts
import { createWorkerClient } from "@bpmnkit/worker-client"
import type { JobTypes } from "./generated/bpmn-types.js"

const client = createWorkerClient<JobTypes>()

for await (const job of client.poll("charge-card")) {   // a misspelt job type is a compile error
	const amount = job.variables.amount                  // "amont" is a compile error
	if (job.customHeaders.provider === "stripe") {
		// …
	}
	if (declined) {
		await job.throwError("PAYMENT_DECLINED", "Card declined")   // only codes that a catch event handles
	} else {
		await job.complete({ transactionId })                // required output keys are enforced
	}
}
```

If you do not give a type argument, the client stays untyped, as before.

---
Source: https://bpmnkit.com/docs/guides/typed-workers
