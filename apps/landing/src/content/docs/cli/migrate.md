---
title: casen migrate
description: Convert Camunda 7 BPMN models to Camunda 8 and get a per-element report of what was converted, what needs a person, and what Camunda 8 cannot do — as text or JSON, with a CI gate.
sidebar:
  order: 9
---

`casen migrate c7` converts Camunda 7 models to Camunda 8. It rewrites what it can rewrite
mechanically and reports every Camunda 7 construct it finds, one line per element. The
[migration guide](/docs/guides/migrate-from-camunda-7) explains what is converted and why.

```sh
casen migrate c7 order.bpmn
```

```
order.bpmn → order.c8.bpmn
  19 convertible · 8 manual · 2 unsupported

  UNSUPPORTED
    order-fulfillment  camunda:historyTimeToLive
      Camunda 8 has no per-process history time to live (was "180").
      → Configure data retention for the cluster (Operate, Tasklist and Optimize archiving).
    …
  MANUAL
    Task_ship  camunda:class
      Java delegate class "com.acme.orders.ShipOrderDelegate" runs inside the Camunda 7 engine; …
      → Implement a job worker for type "shipOrderDelegate" …
    …
  CONVERTIBLE
    Task_charge  camunda:type=external
      External task topic "charge-payment" became job type "charge-payment".
    …
```

The groups come in order of work: `unsupported` (Camunda 8 has no equivalent), `manual`
(Camunda 8 has one, but a person must write or check it), `convertible` (done).

## Where the output goes

- By default, each `name.bpmn` is written to `name.c8.bpmn` beside it. The Camunda 7 file is
  never changed.
- With `--out <dir>`, files are written to that directory under their own names. The
  directory is created if it does not exist.
- An existing output file is never overwritten unless you pass `--force`. The command
  reports the file and exits 1.

The output keeps the source file's formatting and element order, so a text diff against the
Camunda 7 file shows only what the migration changed.

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--out <dir>` | beside the input | Write converted files to this directory |
| `--check` | off | Report only. Write nothing, and exit 1 if any `manual` or `unsupported` finding remains |
| `--format` | `text` | `text` or `json` |
| `--force` | off | Overwrite converted files that already exist |

Put the flags after the file names: `casen migrate c7 models/*.bpmn --check`.

### As a pipeline gate

```sh
casen migrate c7 models/*.bpmn --check --format json
```

The JSON is an array with one entry per file: `file`, `output` (`null` with `--check`),
`counts`, and `findings`. Each finding has `elementId`, `elementType`, `processId`,
`construct`, `severity`, `message`, `suggestion`, and `applied`. `applied` tells you if the
converter wrote a Camunda 8 equivalent. A file that already targets Camunda 8, or that cannot
be read, is reported with an `error` and makes the command exit 1.
