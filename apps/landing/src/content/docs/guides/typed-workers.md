---
title: Typed Workers
description: Generate TypeScript types from BPMN so that job types, variables, headers, message names and error codes are checked at compile time, and check that every job type has a worker.
sidebar:
  order: 15
---

A job worker depends on names that the BPMN model defines: the job type, the variables it reads, the
variables it returns, and the error codes it throws. If you type these names by hand, a typo shows
only at runtime, as a job that no worker takes or as an incident.

`casen gen types` reads the BPMN and generates the TypeScript types for these names. The compiler
then checks them for you.

## Generate the types

```sh
casen gen types processes/ --out src/generated/bpmn-types.ts
```

The command accepts files, directories and globs. Commit the generated file, and add the `--check`
command to CI so that the file stays current:

```sh
casen gen types processes/ --out src/generated/bpmn-types.ts --check   # exits 1 when stale
```

For a service task like this one:

```xml
<bpmn:serviceTask id="Charge" name="Charge card">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="charge-card" />
    <zeebe:ioMapping>
      <zeebe:input source="=order.total" target="amount" />
      <zeebe:output source="=transactionId" target="txId" />
    </zeebe:ioMapping>
    <zeebe:taskHeaders>
      <zeebe:header key="provider" value="stripe" />
    </zeebe:taskHeaders>
  </bpmn:extensionElements>
</bpmn:serviceTask>
<bpmn:boundaryEvent id="Declined" attachedToRef="Charge">
  <bpmn:errorEventDefinition errorRef="Err_Declined" />  <!-- errorCode="PAYMENT_DECLINED" -->
</bpmn:boundaryEvent>
```

the command generates:

```ts
export interface ChargeCardVariables {
	amount: unknown
}
export interface ChargeCardOutput {
	transactionId: unknown
}
export interface ChargeCardHeaders {
	readonly provider: "stripe"
}
export type JobTypes = {
	"charge-card": {
		variables: ChargeCardVariables
		output: ChargeCardOutput
		headers: ChargeCardHeaders
		errors: "PAYMENT_DECLINED"
		processIds: "order-process"
		elementIds: "Charge"
	}
}
```

The file also exports `ProcessId`, `JobType`, `MessageName` (the `Messages` interface documents the
correlation key of each message), `SignalName`, `ErrorCode` and `EscalationCode`. Each of these has a
`const` array, for example `jobTypes` and `errorCodes`, that you can use at runtime.

## Use the types with `@bpmnkit/worker-client`

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

## Use the types with another client

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

## How the types are derived

FEEL cannot be typed statically, so every value is `unknown`. But the keys are exact, and a key is
optional when the model does not guarantee it.

| What | Rule |
|---|---|
| Job types | Every element with a static `zeebe:taskDefinition` type: service, send, script and business rule tasks, message throw events, and ad-hoc sub-processes (AI Agent job workers). User tasks are excluded. A job type written as a FEEL expression (`=…`) is skipped and listed in the file header. |
| Variables | The targets of the element's `zeebe:input` mappings, all required. If the element has no input mappings, the variables in scope on its incoming flows, from the variable-flow analysis, all optional. |
| Output | The variables that the element's `zeebe:output` sources read, less the element's own input targets. A key is required when the source is a plain reference such as `=total`, and optional otherwise. If the element has no output mappings, the output is the variables that downstream elements read and that nothing else in the process sets, all optional. |
| Headers | The `zeebe:taskHeaders` of the element, with their values as literal types. |
| Errors | The error codes that error boundary events catch on the element and on its enclosing sub-processes, and the codes that error event sub-processes catch in those scopes. A catch-all error event makes the type `string`. If nothing catches an error, the type is `never`, because an uncaught error raises an incident. |
| Shared job types | When two or more elements use the same job type, their contracts are merged. A key is required only when all of the elements require it. |
| Processes | Only executable processes (`isExecutable="true"`) are read. |

The output is deterministic: everything is sorted. Two job types that give the same TypeScript name,
for example `ship-order` and `ship_order`, get a numeric suffix (`ShipOrder`, `ShipOrder2`).

To generate the types from code, use the same function that the CLI uses:

```ts
import { Bpmn, generateProcessTypes, extractProcessContract } from "@bpmnkit/core"

const source = generateProcessTypes([Bpmn.parse(orderXml), Bpmn.parse(returnsXml)])
const contract = extractProcessContract(Bpmn.parse(orderXml))   // the same data as objects
```
