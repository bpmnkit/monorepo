# Versioning process definitions — Selecting the best versioning approach — Things to consider before migration

When planning your migration, here are some factors to consider:

- _Do I have a good reason to migrate?_ Technically, you do not have to migrate process instances when using Camunda. Previous process definition instances will simply continue to run as intended (with some important caveats, note other things to consider below). Here are some examples of good reasons to migrate:
  - Your supporting implementation resources have changed.
  - Your latest process definition represents a substantial change in your business process.
  - Your latest process definition fixes a bug.
  - Your latest process definition enforces some time-sensitive legal obligations or rules.
- _How big of a difference is there between process definition versions?_ Not only the definition itself, but the data required to be present at any given time in your instance.
- _Did supporting implementation resources change from the previous deployment?_ If a service implementation changes in the new deployment and the reference to the implementation did not change from the previous deployment, then older process instances that are in flight will utilize the newer implementation by default upon deployment of the new resources. If that breaks older instances, then you must migrate.
- _Do I have a proper infrastructure to support “real data” testing of my migration?_ This might be the most important aspect. An ideal way to test your process instance migration would be to have prod-like data in some kind of staging environment that represents not only the type and quality of existing production data, but also volume, scale, and size. You run your migration there so that you know what to expect when it comes time to migrate in production. You also need the ability to quickly reset this data via some kind of snapshot, so that you can test over and over again. You can expect many iterations of your migration before you move forward.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
