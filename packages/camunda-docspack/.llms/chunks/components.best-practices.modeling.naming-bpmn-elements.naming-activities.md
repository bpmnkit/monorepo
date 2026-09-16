# Naming BPMN elements — Naming activities

Name a _task_ using an object and a verb in the infinitive. By doing this, you consistently describe _what you do with an object_.

Diagram (BPMN):
  "Check invoice"
  "Review draft"
  "Announce job"

Name a _subprocess_ (or _call activity_) by using an object and a (by convention _nominalized_) verb. Similar to tasks, you should always describe _what you do with an object_.

Diagram (BPMN):
  subprocess "Draft review"
  subprocess "Invoice check"
  subprocess "Job announcement"

**Note**
Avoid very broad and general verbs like "Handle invoice" or "Process order." Try to be more specific about what you do in your activity from a business perspective.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements
