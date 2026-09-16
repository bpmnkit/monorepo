# Workflow patterns — Reacting to events — Time based

You want to react if a certain point in time is due or a specific time duration has passed. This is related to [Workflow Pattern 23: Transient Trigger](http://www.workflowpatterns.com/patterns/control/new/wcp23.php).

In BPMN, you can leverage [boundary events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events#boundary-events) or [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses).

Those events can be interrupting or non-interrupting, meaning you will either interrupt the current activity, or start something in parallel.

Diagram (BPMN):
  start "Request received" → service task "Qualify request" → user task "Approve request" → exclusive gateway "Approved?"
    — [Yes: =approved] user task "Process request" → end "Request processed"
    — [No: =not(approved)] service task "Inform about rejection" → end "Request rejected"

**(1)**

This timer is non-interrupting (dashed line), so the **Escalate request approval** task is started in parallel, additionally to the **Approve request** task. The idea is that the escalation task might make a manager double-checking the original task does not slip. Non-interrupting events can also be recurring, so you could also escalate "every two hours".

**(2)**

This timer is interrupting (solid line). Once it fires, the **Approve request** task is canceled and the process continues on the alternative path, in this case to automatically reject the request. Note that both timers so far can only happen if the task **Approve request** is active.

**(3)**

This is an event subprocess (dotted line). This can be activated from everywhere in the current scope. In this example, the scope is the whole process.

**(4)**

So if the process is not completed within the defined SLA, the timer fires and the event subprocess is started. As the timer is non-interrupting (dashed line again), it does not intervene with the typical flow of operations, but starts something additionally in parallel.

**Note**
The above process is not necessarily modeled following all of our [modeling best practices](https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models), but intentionally shows different ways to use BPMN to implement certain workflow patterns.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
