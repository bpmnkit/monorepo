# Process instance suspension — Behavior during suspension

The following describes what happens to each element type when a process instance is suspended.

### Jobs

Job handout is suppressed during suspension: workers can't pick up new jobs from a suspended process instance.

Jobs already running in a worker before suspension are not interrupted. They keep executing, but any attempt to complete or fail the job during suspension is rejected. If the instance resumes before the worker finishes, the job can complete normally. If the worker completes or fails the job while the instance is still suspended, the job is re-activated on resume and executed again. Because of this at-least-once behavior, outbound actions performed by the job (for example, an API call or a message) may run more than once if they are not idempotent.

### Timers

Timers don't trigger during suspension. When the instance resumes, any due timers fire immediately as a catch-up. For non-interrupting cycle timers, only one firing occurs on resume, even if the timer became due multiple times during suspension.

### Messages

Message correlation doesn't happen during suspension. Messages without a TTL that arrive while the instance is suspended are discarded for that instance. Messages with a TTL may still correlate after resume, provided the TTL has not expired at the time the instance resumes.

### Signals

Signals received while a process instance is suspended are discarded and never replayed. Unlike timers, there is no catch-up for signals on resume.

### Multi-instance

If an active multi-instance body is suspended, child elements are spawned on resume according to the input collection at the time of suspension. Changes to the input collection during suspension (whether items are added or removed) are not taken into account once the multi-instance body has been created.

### Call activities

Suspending a root process instance does not automatically suspend its call-activity children. Each child instance continues executing independently.

If an active call activity has an interrupting boundary event and the child fires a matching event (for example, an error or escalation) while the parent is suspended, the call activity element of the suspended process instance transitions to terminated, while the boundary event becomes active. Completion of the boundary event is deferred until resume, but this means a suspended instance's state can change for this specific edge case.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
