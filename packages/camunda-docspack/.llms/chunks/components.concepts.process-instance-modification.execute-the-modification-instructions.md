# Process instance modification — Execute the modification instructions

A modification command can contain multiple activation and termination instructions. The process instance applies these
instructions in a specific order:

1. Apply all activation instructions.
2. Apply all termination instructions.

The order of the instructions matters if the modification terminates the last active instances of the process instance
or inside a subprocess, and activates an element in the process instance or the subprocess. Since the process instance
applies the activation instructions first, the process instance or the subprocess still has an active instance and is
not terminated.

If the process instance can't apply one of the modification instructions, it rejects the modification command. For
example, if one of the terminating element instances is not active. As a result, the process instance is not modified
and is in the same state as before. It applies the instructions of a modification command in a **transactional** way (i.e.
apply all or nothing).

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-modification
