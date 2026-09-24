# Process Templates — Use a template

Pick one of three ways from a template's page:

- **Open in editor** opens the diagram in the [browser editor](/editor). The link is
  `/editor?template=<id>`, and it only accepts a template id from the gallery.
- **Download .bpmn** saves the process model. The page also links the scenarios file and any
  DMN or form files.
- **`casen template use`** writes all the files into your project:

```sh
casen template list                          # all templates
casen template list --category ai-agents     # one category
casen template use purchase-request-approval processes/
```

```text
✓ Wrote processes/purchase-request-approval.bpmn
✓ Wrote processes/purchase-request-approval.bpmn.tests.json
✓ Wrote processes/approval-matrix.dmn
```

`casen template use` does not overwrite a file that already exists. Pass `--force` to
overwrite it. Then deploy each file with `casen deploy deploy <file> --target camunda8`, or
deploy them from the editor.

---
Source: https://bpmnkit.com/docs/guides/templates
