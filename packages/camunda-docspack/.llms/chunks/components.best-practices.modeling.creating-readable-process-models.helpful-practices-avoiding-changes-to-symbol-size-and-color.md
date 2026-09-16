# Creating readable process models — Helpful practices — Avoiding changes to symbol size and color

Leave the _size of symbols as it is_ by default. For example, different sizes of tasks or events suggest that the bigger symbol is more important than the smaller one - an often unwarranted assumption. Instead of writing long labels, use short and consistent labels in line with your [naming conventions](https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements) and move all additional information into BPMN annotations associated to your specific BPMN element.

Furthermore, avoid _excessive use of colors_. Experience shows that colors are visually very strong instruments and psychologically very suggestive, but will typically suggest different things to different readers. Additionally, a colorful model often looks less professional.

However, there are valid exceptions. For example, you could mark the _happy path_ through a process with a visually weak coloring:

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

Another case for useful coloring might be to make a visual difference between _human_ and _technical flows_ within a bigger collaboration diagram by coloring the header bar on the left side of the pools.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
