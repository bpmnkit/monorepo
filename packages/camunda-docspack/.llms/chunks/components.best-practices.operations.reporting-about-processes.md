# Reporting about processes

The Camunda engine automatically collects audit information about historical process or instances for users to leverage and generate relevant reports.

The Camunda engine automatically collects audit information about historical process or decision instances. Leverage this data by generating and displaying business relevant reports. Add business relevant phases and milestones to your process models serving as a basis for key performance indicators (KPIs).


## Modeling key performance indicators (KPIs)

When modeling a process, you always add information about important key performance indicators implicitly; for example, by introducing **start and end events**.

Additionally, you can explicitly add the following:

- Meaningful additional business **milestones** by modeling **intermediate events**, for example. This might not have any execution semantics other than leaving a trace in the history of the workflow engine. The milestone is met as soon as the process has passed the event. Its status can therefore be **passed** or **not passed**.

- Meaningful business **phases** by modeling things like (embedded) **subprocesses**. In contrast to a milestone, a phase's state can be **not entered**, currently **active**, or **passed**.

Consider the following example - a "Tweet Approval Process" shows start and end events as well as **milestones**:

Diagram (BPMN): TwitterReportingDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [No: =not(approved)] exclusive gateway → service task "Send rejection notification" → end "Tweet not published"
    — [Yes: =approved] intermediate throw event "Tweet approved" → service task "Publish on Twitter" → end "Tweet published"

**(3)**

After one business day, the reviewer is reminded to speed up - and such reviews are internally _marked_ by passing the end event 'Review done slowly'.

**(4)**

**Approved tweets** will pass the additional **intermediate event**. The **cycle time** up until that point is automatically captured too.

**(5)**

Furthermore, when tweets are successfully published, we are interested in the **ratio** of those tweets...

**(6)**

...when compared to tweets that do not get published. Therefore, we model _two different end events_ representing those two business end states of the process.

**Note**
Duplicate tweets will _not be published_ even though they have been _approved_ before. The more precisely we describe and _name_ the business semantics of events, the better our KPI's will reflect the reality we want to measure!

When you do not (only) want to concentrate on milestones, but _phases_ in your process, model the phases as subprocesses:

Diagram (BPMN): TwitterReportingDemoProcess
  start "New Tweet written" → subprocess "Review" → subprocess "Publication" → end "Tweet processed"

**(1)**

The phase _Review_—modeled with a subprocess—will be active, while the human reviewer will need to find time to complete the task...

**(2)**

...whereas the phase _Publication_ will be completed automatically - hence process instances "remaining" there for longer than a few seconds will probably indicate ongoing problems with the uptime and reachability of the used services.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/reporting-about-processes
