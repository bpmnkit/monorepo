# Multi-instance — Sequential vs. parallel

A multi-instance activity is executed either sequentially or in parallel (default). In the BPMN, a sequential multi-instance activity is displayed with three horizontal lines at the bottom. A parallel multi-instance activity is represented by three vertical lines.

In case of a **sequential** multi-instance activity, the instances are executed one at a time. When one instance is completed, a new instance is created for the next element in the `inputCollection`.

![sequential multi-instance](assets/multi-instance-sequential.png)

In case of a **parallel** multi-instance activity, all instances are created when the multi-instance body is activated. The instances are executed concurrently and independently from each other.

![parallel multi-instance](assets/multi-instance-parallel.png)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
