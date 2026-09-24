# Migrate from Camunda 7

Camunda 7 Community Edition reached end of life with 7.24 in October 2025. Enterprise support
continues to 2030, and the community forks [Operaton](https://operaton.org) and
[CIB seven](https://www.cibseven.org) carry the Camunda 7 engine forward. If you move to
Camunda 8, your models must change: Camunda 8 reads `zeebe:` extensions and FEEL, and it
ignores `camunda:` extensions and JUEL.

BPMN Kit converts the model. It rewrites what can be rewritten mechanically, and it reports
every Camunda 7 construct it finds, with a severity and a Camunda 8 suggestion:

- **convertible** — rewritten. The Camunda 8 model does the same thing.
- **manual** — Camunda 8 has an equivalent, but a person must write or check it. Examples are a
  job worker for a Java delegate, or a correlation key for a message.
- **unsupported** — Camunda 8 has no equivalent. The model, or the system around it, must change.

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
