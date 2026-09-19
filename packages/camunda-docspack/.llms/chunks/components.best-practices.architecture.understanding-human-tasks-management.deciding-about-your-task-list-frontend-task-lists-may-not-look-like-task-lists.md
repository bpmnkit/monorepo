# Understanding human task management — Deciding about your task list frontend — Task lists may not look like task lists

There are situations where you might want to show a user interface that does not look like a task list, even if it is fed by tasks. The following _example_ shows such a situation in the document _input management_ process of a company. Every document is handled by a separate process instance, but users typically look at complete mailings consisting of several such documents. In a customer scenario, there were people in charge of assessing the scanned mailing and distributing the individual documents to the responsible departments. It was important to do that in one step, as sometimes documents referred to each other.

So you have several user tasks which are heavily _interdependent_ from a business point of view and should therefore be completed _in one step_ by the same person.

The solution to this was a custom user interface that basically queries for human tasks, but show them grouped by mailings:

![custom tasklist mockup](understanding-human-tasks-management-assets/tasklist-mockup.png)

**(1)**

The custom tasklist shows each mailing as one "distribution task", even though they consist of several human tasks fetched from the workflow instance.

**(2)**

The custom user interface allows you to work on all four human tasks at once. By dragging and dropping a document within the tree, the user can choose to which department the document is delivered to.

**(3)**

In case the user detects a scanning problem, they can request a new scan of the mailing. But as soon
as all documents are quality assured, the button **Distribute Mailing** gets enabled. By clicking on it, the system completes all four human tasks - one for each document - which moves forward the four process instances associated with the documents.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/understanding-human-tasks-management
