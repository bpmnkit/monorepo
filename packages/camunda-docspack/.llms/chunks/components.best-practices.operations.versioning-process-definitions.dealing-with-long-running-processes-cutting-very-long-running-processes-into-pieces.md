# Versioning process definitions — Dealing with long running processes — Cutting very long running processes into pieces

The longer the lifespans of process instances are, the bigger the _risks_ that you might want to exchange important software components like e.g. the workflow engine itself. Typically, _very long-running, end-to-end processes_ (running longer than _six months_) have periods without activity (e.g. waiting for a certain date in the future). Cut the process into several independent process definitions at these points.

Diagram (BPMN):
  start "Order received" → call activity "Order acceptance" → call activity "Order Shipping" → call activity "Order Billing" → service task "Create renewal reminder" → end "Order processed"

Diagram (BPMN):
  start "Renewal reminder got due" → user task "Call Customer" → exclusive gateway "Convinced?"
    — [No] call activity "Contract Cancellation" → end "Contract cancelled"
    — [Yes] call activity "Contract Renewal" → end "Contract renewed"

Diagram (BPMN):
  start "Periodically" → service task "Load due reminders" → "Start renewal process" → end "Timer processed"
  note: for every due reminder

**(1)**

After the mobile phone was shipped, we finish the first process instance and just keep a reminder for the renewal in 24 months.

**(2)**

We periodically check due renewals and start new process instances whenever necessary.

We typically don't model such processes in one diagram it's shown here as a way to show the message flow. Typically, we would rather use a separate diagram per executable process and either leave out the other process completely or show it as a collapsed pool.

Also try to avoid modeling the complete life-cycle of very long living objects, like a life insurance contract. Only capture the active phases as separate processes (e.g. "Policy Issuing", "Address Change", "Cancellation" or "Death").

Having said this, we want to emphasize that the engine is perfectly fine with handling lots of process instances for a long time. So if you want to have process instances waiting for months or years, you can still do so. Just make sure you think about all resulting implications.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
