# Process instance suspension — Allowed actions on suspended instances

External commands against a suspended process instance are blocked, with the following exceptions:

### Variable updates

You can update variables on a suspended process instance, including element-instance variables. The exception is user task variables, for which any operations are blocked during suspension.

Variable changes take effect immediately. If a command recorded before suspension depends on a variable you modified or deleted during suspension, that command may fail on resume and create an incident.

**Note**
Variable updates can be overwritten on resume if a buffered completion command carries an older value of the same variable. This happens when the completion was the next processing step at the time suspension was applied, so its command (including the pre-suspension variable value) was already buffered.

### Cancellation

You can cancel a suspended process instance.

### Resumption

You can resume a suspended process instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
