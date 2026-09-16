# BPMN primer — Modeling BPMN diagrams — Sequence flow: Controlling the flow of execution

A core concept of BPMN is a **sequence flow** that defines the order in which steps in the process happen. In BPMN's visual representation, a sequence flow is an arrow connecting two elements. The direction of the arrow indicates their order of execution.

![sequence flow](./assets/sequenceflow.png)

You can think of process execution as tokens running through the process model. When a process is started, a token is created at the beginning of the model and advances with every completed step. When the token reaches the end of the process, it is consumed and the process instance ends. Zeebe's task is to drive the token and to make sure the job workers are invoked whenever necessary.

<center>
<ReactPlayer
playing
loop
playsInline
height="200px"
src="/videos/sequenceflow.mp4"
/>
</center>

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer
