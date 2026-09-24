---
"@bpmnkit/reebe-wasm": patch
---

Reebe now runs link events, compensation and the inner elements of ad-hoc sub-processes, and follows more of Zeebe's gateway and incident rules.

- Link events: a link throw event continues at the link catch event of the same name in its scope. Deployment fails for a throw event without a matching catch event, for two catch events with the same name in one scope, and for an empty link name.
- Compensation: a compensation handler linked to a compensation boundary event by an association deploys. A compensation intermediate throw or end event starts the handlers of the activities that completed in its scope, and in the completed sub-processes inside it, all at once and most recently completed first. It waits until they have completed. `activityRef` limits it to one activity. A throw event in an event sub-process compensates the scope around the event sub-process. A multi-instance activity is compensated once. A handler starts with a copy of the compensated activity's local variables.
- Ad-hoc sub-processes: every activation runs in its own inner instance. Run by Zeebe, `activeElementsCollection`, `completionCondition` and `cancelRemainingInstances` decide what runs and when the sub-process completes. With a job worker, the job result's `activateElements`, `isCompletionConditionFulfilled` and `isCancelRemainingInstances` do, and the job is created again after each activation completes. A job completed without such a result still completes the sub-process. `outputCollection` and `outputElement` are collected.
- An exclusive gateway with no matching condition and no default flow raises a `CONDITION_ERROR` incident. Resolving it retries the gateway, and the same now holds for an inclusive split. Default flows are recognised in sub-processes at every depth, and parallel gateways ignore conditions on their outgoing flows.
- Resolving an incident raised while an element was activating retries that same element instance instead of creating a second one.
- The variables a job worker throws an error with reach the error boundary event or event sub-process that catches it.
- Event sub-process instances report the element type `EVENT_SUB_PROCESS`.
- A complex gateway fails deployment, as in Zeebe.
