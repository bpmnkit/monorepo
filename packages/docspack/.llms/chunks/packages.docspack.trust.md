# @bpmnkit/docspack — Trust

A manifest is third-party input that ends up in a model's context, so it is read as a
security boundary rather than as configuration:

- a chunk path that resolves outside `.llms/` is refused
- the installed `package.json` version supersedes the manifest's, and a disagreement is
  reported by `list`
- chunk ids must be unique and must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`
- packages under the `@docspack-community` scope are labelled unreviewed in every answer

---
Source: https://docs.bpmnkit.com/packages/docspack/
