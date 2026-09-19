# Creating readable process models

Create visual process models to better understand, discuss, and remember processes so models are easy to read and understand.

We create visual process models to better understand, discuss, and remember processes. Hence, it is crucial that models are easy to read and understand. The single most important thing is to use well-chosen labels.


## Essential practices

### Labeling BPMN elements

Use [conventions for naming BPMN elements](https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements); this will consistently inform the reader of the business semantics. The clarity and meaning of a process is often only as good as its labels.

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

**(1)**

_Start event_ labels informs the reader of how the process is _triggered_.

**(2)**

An _activity_ - labeled as "activity" - informs the reader of the piece of _work_ to be _carried out_.

**(3)**

_Gateway_ labels clarifies based on which condition(s) and along _which sequence flow_ the process proceeds.

**(4)**

Labeled _boundary events_ clearly express in which cases a process execustion might follow an _exceptional path_.

**(5)**

Labeled _end events_ characterize end _results_ of the process from a business perspective.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
