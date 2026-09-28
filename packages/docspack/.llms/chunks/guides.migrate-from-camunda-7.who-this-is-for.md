# Migrate from Camunda 7 — Who this is for

- Teams that have a folder of Camunda 7 `.bpmn` files and want to know how much work the
  models are, before they plan the migration.
- Teams that work in TypeScript or JavaScript and do not want a Java toolchain to convert
  models.
- CI pipelines: `casen migrate c7 --check` fails while manual work remains.


## Run it

```sh
casen migrate c7 models/*.bpmn            # writes models/*.c8.bpmn
casen migrate c7 models/*.bpmn --out c8   # writes c8/*.bpmn
casen migrate c7 models/*.bpmn --check    # report only, exit 1 on manual work
```

[`casen migrate`](/docs/cli/migrate) has the flags and the JSON format. From code:

```typescript
import { Bpmn, convertCamunda7 } from "@bpmnkit/core"

const { definitions, report } = convertCamunda7(Bpmn.parse(xml))
for (const f of report.findings) console.log(f.severity, f.elementId, f.construct, f.message)
const c8Xml = Bpmn.export(definitions)
```

`analyzeCamunda7(definitions)` returns the same report and does not change the model. The
`sourceXml` option of earlier versions is still accepted, but it has no effect. The parser now
keeps `camunda:` attributes on multi-instance loops and on event definitions, where Camunda 7
stores `camunda:collection` and the implementation of message throw events.

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
