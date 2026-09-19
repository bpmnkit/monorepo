# Size your environment — Sizing requirements and influencing factors — Throughput

Throughput defines how many process instances can be executed within a certain timeframe.

It is typically easy to estimate the number of process instances per day you need to execute.
However, hardware sizing depends more on the **number of BPMN tasks** in a process model. If you already know your future process model, you can use it to count the number of tasks in the process. For example, the following onboarding process contains five service tasks in a typical execution:

Diagram (BPMN):
  start "Application received" → service task "Get credit score" → business rule task "Check application automatically" → exclusive gateway "Risk?"
    — [green (no risk): = riskLevel = "green"] exclusive gateway → service task "Deliver confirmation" → send task "Send confirmation" → end "Application issued"
    — [yellow (moderate risk): = riskLevel = "yellow"] user task "Decide on application" → exclusive gateway "Decision?"
      — [application accepted: = approved] (back to exclusive gateway)
      — [application declined: = not(approved)] exclusive gateway → service task "Reject application" → send task "Send rejection" → end "Application rejected"
    — [red (high risk): =risklevel = "red"] (back to exclusive gateway)

**Tip**
If you don't yet know the number of service tasks, Camunda recommends assuming **10 service tasks** as a rule of thumb.

The number of tasks per process allows you to calculate the number of tasks per day. You can also convert this to tasks per second. For example:

| Indicator                          |    Number | Calculation method | Notes                                        |
| :--------------------------------- | --------: | :----------------: | :------------------------------------------- |
| Onboarding instances per year      | 5,000,000 |                    | Business input.                              |
| Process instances per business day |    20,000 |       / 250        | Average number of working days in a year.    |
| Tasks per day                      |   100,000 |        \* 5        | Tasks in the process model as counted above. |
| Tasks per second                   |      1.16 |   / (24\*60\*60)   | Seconds per day.                             |

In most cases, Camunda defines throughput per day, as this time frame is easier to understand. However, in high-performance use cases, you might need to define the throughput per second.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment
