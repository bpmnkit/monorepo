# Timer events — Intermediate timer catch events

An intermediate timer catch event can either be a time duration, or a time date.

When an intermediate timer catch event is entered, a corresponding timer is scheduled. The process instance stops at this point and waits until the timer is triggered. When the timer is triggered, the catch event is completed and the process instance continues.


## Timer boundary events

An interrupting timer boundary event must have a time duration, or a time date definition. When the corresponding timer
is triggered, the activity is terminated. Interrupting timer boundary events are often used to model timeouts; for
example, canceling the processing after five minutes and doing something else.

A non-interrupting timer boundary event must have either a time duration, a time cycle definition, or a time date
definition. When the activity is entered, it schedules a corresponding timer. If the timer is triggered and defined as
time cycle with repetitions greater than zero, it schedules the timer again until the defined number of repetitions is
reached. It's important to note that a non-interrupting timer boundary event that's defined with a time duration will
only trigger a single time once the date is reached.

Non-interrupting timer boundary events are often used to model notifications; for example, contacting support if the processing takes longer than an hour.

Attached to an [ad-hoc sub-process](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses) hosting an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent), a timer boundary event lets the process interrupt or redirect a running agent that takes too long, one of the patterns described in [mixing agents with workflow patterns](https://docs.camunda.io/docs/next/components/agentic-orchestration/design-architecture#mix-agents-with-workflow-patterns).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
