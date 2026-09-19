# Routing events to processes — Routing events from the outside to the workflow engine

Most events actually occur somewhere external to the workflow engine and need to be routed to it. The core workflow engine is by design not concerned with the technical part of receiving external messages, but you can receive messages and route them to the workflow engine by the following ways:

- Using API: Receive the message by means of your platform-specific activities such as connecting to a AMQP queue or processing a REST request and then route it to the process.
- Using connectors: Configure a connector to receive messages such as Kafka records and rote it to the process. Note that this possibility works for Camunda 8 only.
- Using the Processes MCP Server: Apply the [MCP start event element template](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-mcp-start-event) to a message start event, and the [Processes MCP Server](https://docs.camunda.io/docs/next/apis-tools/processes-mcp/processes-mcp-overview) registers the process as a tool that MCP clients, such as AI agents, can call to start an instance. See [expose a process as an MCP tool](https://docs.camunda.io/docs/next/components/agentic-orchestration/expose-process-as-mcp-tool).

### Starting process instance by BPMN process ID

If you have only one starting point (none start event) in your process definition, you reference the process definition by the ID in the BPMN XML file.

**Note**
This is the most common case and requires using the [`CreateProcessInstance`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#createprocessinstance-rpc) API.

Example in Java:

```java
processInstance = zeebeClient.newCreateInstanceCommand()
  .bpmnProcessId("invoice").latestVersion()
  .send()
  .exceptionally( throwable -> { throw new RuntimeException("Could not create new process instance", throwable); });
```

Example in Node.js:

```js
zbc.createWorkflowInstance({
  bpmnProcessId: "invoice",
});
```

This starts a new process instance in the latest version of the process definition. You can also start a specific version of a process definition:

```java
processInstance = zeebeClient.newCreateInstanceCommand()
  .bpmnProcessId("invoice").version(5)
  //...
```

or

```js
zbc.createWorkflowInstance({
  bpmnProcessId: "invoice",
  version: 6,
});
```

You can also use [`CreateProcessInstanceWithResult`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#createprocessinstancewithresult-rpc) instead, if you want to block the execution until the process instance has completed.

### Starting process instance by message

As soon as you have multiple possible starting points, you have to use named messages to start process instances. The API method is [`PublishMessage`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#publishmessage-rpc):

```java
client.newPublishMessageCommand()
  .messageName("message_invoiceReceived") // <1>
  .corrlationKey(invoiceId) // <2>
  .variables( // <3>
	  //...
  ).send()
  .exceptionally( throwable -> { throw new RuntimeException("Could not publish message", throwable); });
```

**(1)**

Message name as defined in the BPMN.

**(2)**

Correlation key has to be provided, even if a start event does not require correlation.

**(3)**

_Payload_ delivered with the message.

On one hand, now you do not have to know the key of the BPMN process. On the other hand, you cannot influence the version of the process definition used when starting a process instance by message.

The message name for start events should be unique for the whole workflow engine - otherwise you might experience side effects you did not intend (like starting other processes too).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
