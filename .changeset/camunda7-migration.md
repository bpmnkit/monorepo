---
"@bpmnkit/core": minor
"@bpmnkit/cli": minor
---

Camunda 7 → 8 model migration. `casen migrate c7 <files...>` converts Camunda 7 models to Camunda 8. It writes `<name>.c8.bpmn` beside each input, or writes into `--out <dir>`, and never overwrites a file without `--force`. It reports every Camunda 7 construct as `convertible`, `manual` or `unsupported`, with the Camunda 8 equivalent. `--check` writes nothing and exits 1 while manual or unsupported findings remain. `--format json` gives the report as JSON.

`@bpmnkit/core` adds `convertCamunda7(definitions, { executionPlatformVersion? })`, `analyzeCamunda7` and `translateJuelToFeel`, all pure and dependency-free. They convert external tasks, IO mappings, conditions, timers, user-task assignment, schedule, priority and forms, decisions, call-activity variable passing, multi-instance collections, FEEL scripts, version tags and properties. Java delegates get a job type from a documented naming rule and keep the original as a task header. JUEL becomes FEEL only when the translation is provable; any other expression is kept and reported as manual.
