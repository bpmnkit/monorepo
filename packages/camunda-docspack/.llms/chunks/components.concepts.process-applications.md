# Projects

A project is a type of folder that contains a set of related files you can work on and deploy as a single bundle.

Solutions built with Camunda typically consist of multiple resources that represent the end-to-end use case, such as an entry point process, called supporting processes, DMN decisions, or forms.

Bundled together, versioned together, and deployed together, these resources constitute a _project_.

For instance, a consumer loan approval project might bundle:

- A BPMN process as an entry point (for example, consumer-loan-application.bpmn) to define the workflow.
- DMN decision tables (for example, interest-rate-calculation.dmn, credit-score-calculation.dmn) for business rules.
- Forms (for example, loan-application-review.form) for user interactions.

**Tip**
We recommend you use a project for all your non-trivial automation solutions.

Our [Modeler](https://docs.camunda.io/docs/next/components/modeler/about-modeler) applications support you as you develop a project by different means:

- Advanced editor support with contextual assistance
- Versioning and review features
- Deployment of project files as a unit

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-applications
