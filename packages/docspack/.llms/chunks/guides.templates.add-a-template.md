# Process Templates — Add a template

Templates are TypeScript files in `packages/patterns/src/templates/`, one file per category.
Add a `ProcessTemplate` object to the file, then add it to `ALL_TEMPLATES` in `index.ts`. The
gallery test checks it with no other change: it must build, lint with no errors, round-trip,
and pass every scenario. The gallery page, the `casen template` commands and `llms.txt` all
read the same list.

---
Source: https://bpmnkit.com/docs/guides/templates
