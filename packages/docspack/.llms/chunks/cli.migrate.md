# casen migrate

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

---
Source: https://bpmnkit.com/docs/cli/migrate
