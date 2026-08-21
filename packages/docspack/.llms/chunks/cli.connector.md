# casen connector

`casen connector` has two independent jobs: **browse** the 116 bundled Camunda 8 out-of-the-box
connector templates (`search`/`show` — used by the AI generation pipeline to wire a plan step to
a real service), and **generate** brand-new connector element templates from OpenAPI 3.x/Swagger
2.x specs (`generate`/`catalog` — for APIs Camunda doesn't ship a template for).


## Commands

```
casen connector
├── search      — find a bundled OOTB connector template by name/keyword
├── show        — show a bundled template's required/optional inputs
├── generate    — generate new templates from an OpenAPI spec file or catalog entry
└── catalog     — list all built-in OpenAPI-catalog entries (for `generate`)
```

---
Source: https://docs.bpmnkit.com/cli/connector/
