# Workflow patterns

For end-to-end process orchestration, you must accurately express the things happening in your business processes, requiring workflow patterns.

For true end-to-end process orchestration, you must be able to accurately express all the things happening in your business processes which will require simple and advanced workflow patterns. This page describes typical patterns and how you can implement them using Camunda and BPMN.


## The power of BPMN

Let's discuss the ISO standard [Business Process Model and Notation (BPMN)](https://camunda.com/bpmn/) first, as this is really a great workflow language to express workflow patterns. BPMN was developed as a collaboration of different vendors rooted in real-life industry experience. It happened during a time when the scientific background of workflow patterns was already well researched, for example by the [Workflow Patterns Initiative](http://www.workflowpatterns.com/).

In other words, scientists already wrote down all the patterns that are important to express any problem you might get in a workflow, and BPMN used this knowledge to design a language that implemented all the relevant patterns (refer to this [evaluation](http://www.workflowpatterns.com/evaluations/standard/bpmn.php), for example). Essentially, BPMN is feature complete and will always be able to express what you need to orchestrate your processes.

Additionally, BPMN has expressed all real-life problems rather easily when reflecting on our more than 15 years of hands-on experience with the language.

If you now try to rely on workflow languages that promise to be simpler than BPMN, what it really means is that they lack important workflow patterns. You might want to look in the blog post on [why process orchestration needs advanced workflow patterns](https://camunda.com/blog/2022/07/why-process-orchestration-needs-advanced-workflow-patterns/), showing exemplary workarounds that are necessary if the language cannot express certain patterns.

Typically, this involves emulating advanced patterns with basic constructs plus programming code so that your development takes longer, your solution becomes more brittle, and the resulting process model can't serve as a communication vehicle for business and IT as the model will be contaminated with technical details.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
