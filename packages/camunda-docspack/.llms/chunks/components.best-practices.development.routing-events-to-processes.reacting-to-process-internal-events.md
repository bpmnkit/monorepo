# Routing events to processes — Reacting to process-internal events

Events relevant for the process execution can occur from within the workflow engine itself.

Consider the following loan application process - or at least the initial part with which the applicant's income is confirmed either via the employer or via the last income tax statement.

Diagram (BPMN):
  start "Loan application received" → exclusive gateway "Applicant is employed?"
    — [No: =not(employed)] exclusive gateway → end "Loan application declined"
    — [Yes: =employed] send task "Request income confirmation"
      — receive task "Confirm income via employer" → end "Loan application confirmed and to be reviewed"
      — (back to receive task "Confirm income via employer")

**(1)**

In case the employer does not confirm the income within three business days, a **timer event** triggers and a human clerk now tries to contact the employer and investigate the situation.

**(2)**

This could end with a successful income confirmation. However, it could also end with new findings regarding the applicant's employment status. We learn that the applicant is actually unemployed.

**(3)**

In this case, a **conditional event** watching this data (for example, a process variable changed by the user task) triggers and causes the process to reconsider the consequences of the new findings.

A conditional event's condition expression is evaluated at it's "scope" creation time, too, and not just when variable data changes. For our example of a boundary conditional event, that means that the activity it is attached to could principally be left immediately via the boundary event. However, our process example evaluates the data via the exclusive gateway - therefore such a scenario is semantically impossible.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
