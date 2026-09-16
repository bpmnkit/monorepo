# Ad-hoc sub-processes

With ad-hoc sub-processes, you can model a flexible set of BPMN activities that execute in any order, any number of times.

With ad-hoc sub-processes, you can model a flexible set of BPMN activities that execute in any order, any number of times.

**Info**
With the [AI Agent Sub-process connector](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-subprocess), you can implement an AI agent that dynamically selects and invokes tools, using the [job worker implementation](#job-worker-implementation) of an ad-hoc sub-process.


## About

Ad-hoc sub-processes are a special kind of [embedded subprocess](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses) with an **ad-hoc marker** (represented
by a **~** tilde character). Compared to regular subprocesses, ad-hoc sub-processes allow more flexibility
for executing inner elements.

![A demo process with an ad-hoc sub-process. Some elements inside the subprocess are active.](assets/ad-hoc-subprocess.png)

The inner elements of an ad-hoc sub-process are not connected to a start or end event. Each element can be executed multiple times, in any order, or skipped.
If elements depend on each other, the elements can be connected by a sequence flow to build a structured sequence within the ad-hoc sub-process.

An ad-hoc sub-process can be handled [internally by Zeebe](#bpmn-implementation), or by using a [job worker](#job-worker-implementation).

### Constraints

An ad-hoc sub-process has the following constraints:

- Must have at least one activity.
- Must not have start events or end events.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses
