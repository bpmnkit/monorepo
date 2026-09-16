# Secret resolution and job activation — Understand why a job is not activated

Two conditions stop a job from being activated even though all of its references have resolved.

### Resolved values exceed the message size

The activation response has to stay within `camunda.cluster.network.max-message-size`, which defaults to `4MB`. A resolved value is usually longer than the placeholder it replaces, so a job that fit with placeholders can fail to fit once the values are injected. A value shorter than its placeholder reduces the response size and does not cause this condition. If the resolved values exceed the available message size, the broker removes that job and every subsequent job from the activation. The jobs remain activatable for a later batch. If a job cannot fit even in an otherwise empty batch, the broker raises a message size incident.

### Secret injection fails

The broker replaces the placeholder at its recorded position in the job variables. If a later variable merge overwrites the expected placeholder, or if the broker cannot read the variables, the broker does not activate the job and raises an incident. The incident also takes the job out of activation until the incident is resolved, so the same failing injection is not retried on every activation.

For how to inspect and resolve either incident, see [troubleshoot secret resolution failures](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
