# @bpmnkit/connectors — API Reference

| Export | Description |
|---|---|
| `listConnectors()` | Every connector in the catalog, as summaries |
| `searchConnectors(query)` | Summaries matching name, description or keywords |
| `getTemplate(id)` | The full `ElementTemplate` for an id |
| `summarizeTemplate(template)` | `ConnectorSummary` from a template you hold |
| `propertyKey(property)` | The variable name a template property binds to |
| `applyConnectorTemplate(id, values)` | Catalog template → builder options + problems |
| `applyElementTemplate(template, values)` | Template object → builder options + problems |
| `applyTemplateToElement(definitions, elementId, template, values)` | Template written onto an element of a parsed model → `{ definitions, problems }` |
| `validateElementTemplate(template)` | `{ valid, problems, warnings }` |
| `readTemplateDocument(text)` | Parse a file holding one template or many |
| `registerElementTemplates(templates)` | Merge templates into the catalog |
| `clearRegisteredTemplates()` | Drop everything registered |
| `CAMUNDA_CONNECTOR_TEMPLATES` | The 116 bundled templates, raw |

From `@bpmnkit/connectors/node`: `discoverElementTemplates`, `collectElementTemplates`,
`DEFAULT_CONFIG_FOLDER`, `TEMPLATES_SUBFOLDER`.

---
Source: https://bpmnkit.com/docs/packages/connectors
