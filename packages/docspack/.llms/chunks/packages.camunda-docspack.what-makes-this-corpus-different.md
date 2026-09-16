# @bpmnkit/camunda-docspack — What makes this corpus different

- **Diagrams as text.** The best-practice pages argue through embedded BPMN
  diagrams, and Camunda's own Markdown export drops them. Each one is rendered as
  a flow description instead, so a page about naming gateways still contains the
  gateway, its question and its conditions.
- **227 API operations.** One digest per endpoint, read from the specification
  rather than from the generated reference pages, with required permissions
  decoded, the version it appeared in, and its consistency guarantee.
- **Every chunk cites its page.** Links are rewritten to absolute
  `docs.camunda.io` URLs and each chunk ends with the page it came from.
- **Nothing dropped silently.** An MDX component the build does not recognise
  fails the build by file and line rather than quietly thinning the corpus.

---
Source: https://bpmnkit.com/docs/packages/camunda-docspack
