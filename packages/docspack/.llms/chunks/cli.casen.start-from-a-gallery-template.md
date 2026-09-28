# casen CLI — Start from a gallery template

`casen template` writes one of the runnable templates from the [gallery](/templates) into your
project. You get the `.bpmn`, a `.bpmn.tests.json` file with its scenarios, and any `.dmn` or
`.form` files the process uses. The skeletons from `casen generate bpmn --template` are empty
starting shapes. A gallery template is a complete process with its job types, mappings and
tests.

```sh
casen template list --category approvals
casen template use expense-approval processes/   # --force overwrites existing files
```

See [Process Templates](/docs/guides/templates) for what each template contains and how to
run its scenarios.

---
Source: https://bpmnkit.com/docs/cli/casen
