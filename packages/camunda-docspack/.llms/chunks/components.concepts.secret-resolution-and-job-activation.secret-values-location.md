# Secret resolution and job activation — Secret values location

Resolved secret values exist only in the activation response and in the pushed job, unless a worker writes the value into a process variable itself (see the warning above). Short of that, everywhere else the placeholder text is what is stored.

| Location                                   | What it contains                                              |
| :----------------------------------------- | :------------------------------------------------------------ |
| The activation response or the pushed job  | The resolved values                                           |
| The job batch `ACTIVATED` event in the log | The placeholder text, or no variables at all on the push path |
| Runtime state and exported records         | The placeholder text                                          |
| Broker logs, including failure logs        | The placeholder text, never a value                           |
| Incident messages                          | The reference and the variable path, never a value            |

As a result, Operate shows `camunda.secrets.<name>` for the process instance even though the worker received the resolved value.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
