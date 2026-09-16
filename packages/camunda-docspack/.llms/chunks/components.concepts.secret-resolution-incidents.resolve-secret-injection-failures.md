# Troubleshoot secret resolution failures — Resolve secret injection failures

A secret injection failure also raises a `SECRET_RESOLUTION_ERROR` incident, but for a different reason. In this case, the secret value was available, but Camunda could not inject it into the job variables.

Each secret reference records the JSON pointer of the variable that contains the placeholder. During activation, Camunda replaces the placeholder at that pointer with the resolved value.

Injection fails when both of the following conditions apply:

- Camunda cannot replace the placeholder at the recorded pointer.
- A `camunda.secrets.<name>` placeholder still remains at that path after all references for the path have been processed.

For example, injection fails if the pointer now addresses a list or object that still contains a secret placeholder. If the value at the pointer no longer contains a placeholder, Camunda [continues without raising an incident](#identify-failures-that-raise-no-incident).

```text
The job with key '2251799813685260' can not be activated, because the secret reference 'camunda.secrets.API_TOKEN' could not be resolved at '/credentials/token'. Fix the variable's value or the input mapping that sets it, then resolve the incident, or use process instance modification to reactivate the element and create a fresh job.
```

If the failure does not identify a specific reference, for example because Camunda cannot read the job variables, the incident uses the following generic message:

```text
The job with key '2251799813685260' can not be activated, because injecting its secret values failed. Resolve the incident, or use process instance modification to reactivate the element and create a fresh job.
```

Long polling and job push use the same incident messages for injection failures.

Typical causes include:

- A variable merge overwrites the placeholder after the job is created.
- An input mapping produces a list or context instead of a single text value.
- A cluster variable changes between input mapping evaluation and job creation.

While the incident is active, the job is not activatable, so the broker does not retry the same failed injection on every poll.

### Retry secret injection

Resolve the incident only after correcting the variable value or the input mapping that produced it. Resolving the incident makes the job activatable again, and Camunda retries injection against the current job variables.

If you cannot restore the placeholder, use [process instance modification](https://docs.camunda.io/docs/next/components/concepts/process-instance-modification) to reactivate the element. This creates a new job and detects its secret references again.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
