# Versioning process definitions — Selecting the best versioning approach — Running versions in parallel

You can run several versions of a model in parallel.

The big _advantage_ of that default behavior is that you can deploy changed process definitions without caring about running process instances. The process engine is able to manage running instances based on different process definitions in parallel.

The _disadvantage_ is that one needs to deal with the operational complexity of different versions of the process running in parallel as well as the additional complexity in case those processes call subprocesses which have different versions of their own.

Run versions _in parallel_ for

- _Development_ or _test systems_ for which you do not care about old instances
- _Phasing out_ existing instances as the existing instances need to finish based on the model they where created with, which often has _legal reasons_.
- Situations in which _migration is not advisable_, because it is too complex and too much effort when weighed against its upsides.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
