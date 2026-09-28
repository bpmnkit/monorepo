# Typed Workers

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

---
Source: https://bpmnkit.com/docs/guides/typed-workers
