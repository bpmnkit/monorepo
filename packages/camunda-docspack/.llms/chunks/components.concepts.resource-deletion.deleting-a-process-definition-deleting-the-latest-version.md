# Resource deletion — Deleting a process definition — Deleting the latest version

When deleting the `latest` version of a process definition, the previous version becomes the new `latest`.

For example, if three versions exist and `Version 3` is the latest, deleting it results in the following:

- No new instances can be created for `Version 3`.
- Creating a new process instance using `latest` creates an instance of `Version 2`.
- If `Version 2` contains timer start events, they are reactivated and triggered according to their schedule.
- If `Version 2` contains message or signal start events, they are reactivated. Publishing a message or broadcasting a signal creates a new process instance of `Version 2`.

Deleting `Version 2` before `Version 3` produces the same behavior, except `Version 1` becomes the new `latest`.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion
