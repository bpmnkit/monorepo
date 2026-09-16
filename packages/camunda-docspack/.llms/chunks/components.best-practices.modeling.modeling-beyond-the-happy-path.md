# Modeling beyond the happy path

Model the happy path before collecting problems and exceptions, prioritizing them, and introducing them incrementally.

First, model the happy path to the desired end result before collecting problems and exceptions, prioritizing them, and introducing them incrementally. Secondly, focus on one selected issue at a time, and choose the right techniques for modeling beyond the happy path.


## The happy path and beyond

The happy path is kind of the default scenario with a positive outcome, so no exceptions, errors, or deviations are experienced. Typically, you want to model the happy path first, and therefore you should define the desired _end result_, find a suitable _start event_, and collect the _activities_ and external _dependencies_ which _always_ need to be considered to reach the result.

When we have that, the diagram shows the _happy path_ of a business process (or of the selectively chosen part of the end-to-end business process):

Diagram (BPMN):
  start "Order received" → "Check order completeness" → "Check customer's credit-worthiness" → "Request delivery date" → intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"

**(1)**

_End Event_: It's often the easiest first step to agree upon the desired ("happy") end _result_ of a process.

**(2)**

_Start Event_: As a second step, one might agree upon a _trigger_ for the work leading to the end result.

**(3)**

_Activities_: After that, you can brainstorm and collect activities which _always_ need to be carried out to reach the result.

**(4)**

_Intermediate Events_: Optionally, you can brainstorm and collect _milestones_ (modeled as blank events) and important external _dependencies_ (e.g. modeled as message events).

### Modeling beyond the happy path by error scenarios

As soon as you have this happy path, start modeling beyond the happy path. Focus on _one_ particular, selected problem at a time.

1. Try to _understand_ the worries for _the business_ in the light of the desired end result.

1. Identify the _undesired end result_ the process will reach in case the problem cannot be mitigated. This informs you about the _end event_ you will eventually reach because of the problem.

1. Identify the affected areas in the happy path. Can the problem occur at a _particular point_, _during_ (one or several) _activities_, or basically _all the time_? This will inform you about the most promising modeling technique for the problem: whether either _gateways_, _boundary events_, or _event-based subprocesses_ can serve you to fork off your "problem path".

This best practice will guide you through practices that help you model beyond the happy path.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
