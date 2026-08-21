# @bpmnkit/connector-gen — Overview

`@bpmnkit/connector-gen` parses OpenAPI 3.x and Swagger 2.x specifications and generates Camunda
REST connector element templates — the `.json` files imported into Camunda Modeler to pre-configure
`bpmn:ServiceTask` nodes.

- **OpenAPI 3.x and Swagger 2.x** — JSON and YAML
- **One template per operation** — method, URL, params, body, auth, output, retries all wired up
- **100-entry built-in catalog** — GitHub, Stripe, Slack, Xero, DocuSign, Adyen, and more
- **Auth auto-detection** — reads `components.securitySchemes` and pre-selects the right auth block
- **FEEL expressions** — path parameters become `="https://base/"+param` expressions automatically
- **Body expansion** — optionally decompose request body properties into individual typed fields
- Zero dependencies beyond `yaml` for YAML parsing

---
Source: https://docs.bpmnkit.com/packages/connector-gen/
