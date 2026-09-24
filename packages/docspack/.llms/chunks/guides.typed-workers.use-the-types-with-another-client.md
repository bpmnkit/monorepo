# Typed Workers — Use the types with another client

The types are plain TypeScript, so you can use them with any client. With
`@camunda8/orchestration-cluster-api`, give the handler's variables and result the types from the
`JobTypes` map:

```ts
import type { JobTypes } from "./generated/bpmn-types.js"

type Charge = JobTypes["charge-card"]
const jobType: keyof JobTypes = "charge-card"

camunda.createJobWorker({
	jobType,
	jobHandler: async (job) => {
		const variables = job.variables as Charge["variables"]
		const output: Charge["output"] = { transactionId: await charge(variables.amount) }
		return job.complete(output)
	},
	// …
})
```


## Check workers against the BPMN

```sh
casen gen types processes/ --check-workers "src/**/*.ts" --strict
```

The check scans your sources for worker registrations. It then reports two types of mismatch:

- A BPMN job type that has no worker.
- A worker whose job type no BPMN element uses. Usually this is a typo or a job type that was renamed.

`--strict` makes the command exit 1 when there is a mismatch. The scan is a heuristic: it finds
only job types that are string literals in the common registration forms. The
[`casen generate` reference](/docs/cli/generate#check-workers-against-the-bpmn) lists these forms.
Job types that start with `io.camunda` are Camunda connectors. The connector runtime runs them, so
the check never reports them as missing.

---
Source: https://bpmnkit.com/docs/guides/typed-workers
