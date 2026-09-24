# Migrate from Camunda 7 — Before and after

A Camunda 7 service task, as Camunda Modeler writes it:

```xml
<bpmn:serviceTask id="Task_charge" name="Charge payment" camunda:asyncBefore="true"
    camunda:type="external" camunda:topic="charge-payment">
  <bpmn:extensionElements>
    <camunda:inputOutput>
      <camunda:inputParameter name="amount">${order.total}</camunda:inputParameter>
      <camunda:inputParameter name="currency">EUR</camunda:inputParameter>
      <camunda:outputParameter name="paymentId">${transactionId}</camunda:outputParameter>
    </camunda:inputOutput>
    <camunda:failedJobRetryTimeCycle>R5/PT5M</camunda:failedJobRetryTimeCycle>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

After `casen migrate c7`:

```xml
<bpmn:serviceTask id="Task_charge" name="Charge payment">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="charge-payment" retries="5"/>
    <zeebe:ioMapping>
      <zeebe:input source="=order.total" target="amount"/>
      <zeebe:input source="=&quot;EUR&quot;" target="currency"/>
      <zeebe:output source="=transactionId" target="paymentId"/>
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

The report for this element has four convertible findings (async, topic, mappings, retry
count). It also has one manual finding: the worker must supply the five-minute back-off when
it fails the job.

The converted output is checked against BPMN Kit's Camunda 8 deploy lint. Everything reported
as convertible lints clean. The remaining deploy errors belong to elements with a manual
finding. An example is a receive task that has no correlation key yet.

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
