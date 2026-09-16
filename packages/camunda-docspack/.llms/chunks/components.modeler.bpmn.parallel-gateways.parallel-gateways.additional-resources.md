# Parallel gateway — Additional resources

### XML representation

A parallel gateway with two outgoing sequence flows:

```xml
<bpmn:parallelGateway id="split" />

<bpmn:sequenceFlow id="to-ship-parcel" sourceRef="split"
  targetRef="shipParcel" />

<bpmn:sequenceFlow id="to-process-payment" sourceRef="split"
  targetRef="processPayment" />
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/parallel-gateways/parallel-gateways
