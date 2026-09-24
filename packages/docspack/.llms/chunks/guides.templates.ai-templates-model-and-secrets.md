# Process Templates — AI templates: model and secrets

Every AI step sends its API key as `{{secrets.ANTHROPIC_API_KEY}}`. Add that connector secret
to your cluster before you deploy. The model is set in one place in the package
(`TEMPLATE_MODEL`). In a template you copied, change the `provider.anthropic.model.model`
input.

The AI Agent Sub-process templates also set an `errorExpression` header. It turns a connector
failure, such as reaching the model-call limit, into the BPMN error `AGENT_FAILED`. An error
boundary on the sub-process catches it, so a failure goes to a fallback path and does not
become an incident.

---
Source: https://bpmnkit.com/docs/guides/templates
