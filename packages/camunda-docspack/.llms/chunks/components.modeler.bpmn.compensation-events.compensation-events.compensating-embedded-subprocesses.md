# Compensation events — Compensating embedded subprocesses

If a process instance enters a compensation throw event and there are
completed [embedded subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses) in the
same scope, it invokes the compensation handlers within these subprocesses and nested subprocesses. The compensation
handlers are not invoked if the subprocess is active or terminated.

![Process with embedded subprocesses](assets/compensation-embedded-subprocess.png)

If the compensation throw event is inside an embedded subprocess, the process instance invokes only the compensation
handlers within the subprocess. It doesn't invoke any compensation handler outside the subprocess.

**Info**

Compensation handlers of child processes are not invoked. The triggering of the compensation stops at the call activity.
To revert the effects of a child process, attach a compensation boundary event on the call activity. Read more about
this in [call activities as compensation handlers](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler#call-activity-as-compensation-handler).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events
