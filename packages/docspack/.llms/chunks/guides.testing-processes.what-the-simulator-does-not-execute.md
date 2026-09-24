# Testing Processes — What the simulator does not execute

The tests are only as good as the simulator's coverage of your model. Read
[Conformance](/docs/getting-started/conformance) for the element-by-element list. The gaps
most likely to affect a test are:

- Some elements complete without their semantics, or are not modelled. See the conformance
  table for which elements are affected.
- A BPMN error thrown from a job (`{ throwError }` or `run.throwError`) fails the instance.
  An error boundary event on the task does not catch it.
- A variable that is first written inside an embedded sub-process stays local to that
  sub-process and is lost when it completes. Zeebe propagates it to the process. To keep
  such a variable, pass it as a start variable.
- Message variables and correlation keys (see [Messages](#messages)).
- Tools inside an ad-hoc sub-process (see [AI agents](#ai-agents)).

Engine timers are module-level, so the `ProcessTest` created last drives them until it is
disposed. Use one `ProcessTest` for each test file. This is the `beforeAll` pattern above.
Vitest runs each file in isolation.

### Zeebe semantics (future)

`@bpmnkit/engine/wasm-runner` runs `.bpmn.tests.json` scenarios on Reebe, which has more
of Zeebe's semantics. A `mode: "wasm"` option for `createProcessTest` is planned but not
yet available. The runner drives a scenario from start to end in one call. Also, the
current Reebe build does not open message subscriptions and does not record job variables
in the way that step-by-step testing needs.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
