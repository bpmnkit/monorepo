# BPMN primer — Modeling BPMN diagrams — Tasks: Units of work

The basic elements of BPMN processes are tasks; these are atomic units of work composed to create a meaningful result. Whenever a token reaches a task, the token stops and Zeebe creates a job and notifies a registered worker to perform work. When that handler signals completion, the token continues on the outgoing sequence flow.

<center>
<ReactPlayer
playing
loop
playsInline
height="300px"
src="/videos/tasks.mp4"
/>
</center>

Choosing the granularity of a task is up to the person modeling the process. For example, the activity of processing an order can be modeled as a single _Process Order_ task, or as three individual tasks _Collect Money_, _Fetch Items_, _Ship Parcel_. If you use Zeebe to orchestrate microservices, one task can represent one microservice invocation.

Refer to the [tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/tasks) section on which types of tasks are currently supported and how to use them.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer
