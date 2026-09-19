# Secret resolution and job activation — Activate a job that references secrets — Long polling

During batch collection, a job with a reference that is not yet cached is skipped without consuming a slot in the batch, so jobs behind it can still be activated in the same response.

The broker then requests resolution of that job's missing references and parks the job until they resolve. A parked job is not activatable, so a later poll does not collect it again and no worker receives it. Once the reference resolves, the job is made activatable again automatically. Neither redeployment nor client action is required.

Two limits affect how many jobs one activation can return:

- If a single activation skips 100 jobs for uncached references, it stops there and marks the batch truncated. The gateway polls the same partition again within the same request, so the jobs behind the cap are not held back until the long poll times out.
- If injecting a job's resolved values would exceed the configured message size, the broker removes that job and every subsequent job from the activation and marks the batch as truncated. These jobs remain activatable for the next activation.

The truncated flag is internal to the broker and the gateway. It is not part of the activate jobs response, so a worker never sees it and does not act on it.

The broker injects the resolved values into a copy of the batch used only for the response. The event the broker appends to its log still carries the placeholders.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
