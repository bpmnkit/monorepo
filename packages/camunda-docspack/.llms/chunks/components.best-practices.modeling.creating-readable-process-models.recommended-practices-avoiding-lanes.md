# Creating readable process models — Recommended practices — Avoiding lanes

Consider _avoiding lanes_ for most of your models all together. They tend to conflict with several of the best practices presented here, like [Modeling _Symmetrically_](#modeling-symmetrically), [Emphasizing the _Happy Path_](#emphasizing-the-happy-path) and [Creating Readable _Sequence Flows_](#creating-readable-sequence-flows). Apart from readability concerns, our experience also shows that lanes make it more difficult to change the resulting process models and therefore cause considerably _more effort in maintenance_.

When modeling on an _operational level_, where showing the responsibility of roles matters most, we recommend to [use _collaboration diagrams_](#using-collaboration-diagrams) with several _separate pools_ for the process participants instead of lanes.

However, the usage of lanes might be meaningful for:

- _Strategic_ level models (refer to [BPMN Tutorial](https://camunda.com/bpmn/) and [Real-Life BPMN](https://www.amazon.com/Real-Life-BPMN-4th-introduction-DMN/dp/1086302095/) on details for modeling levels) - especially when they have a focus on _responsibilities and their borders_.

- _Technical/executable_ models with a focus on _human work-flow_ and its ongoing "ping pong" between several participants.

For these cases, also consider alternative methods to maintain and show roles:

- As a _visible part_ of the _task name_, e.g. in between squared brackets []: _"Review tweet [Boss]"_.

**Caution: Camunda 7 Only**
During execution you can remove this part of the task name if you like by using simple mechanisms like shown in the [Task Name Beautifier](https://github.com/camunda/camunda-consulting/tree/master/snippets/task-name-beautifier) so it does not clutter your tasklist.

- As a _text annotation_ or a _custom artifact_

**Note**
Roles are part of your executable BPMN process model as _technical attributes_ anyway - even if hidden in the BPMN diagram. For example, they can be used during execution for assignment at runtime.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
