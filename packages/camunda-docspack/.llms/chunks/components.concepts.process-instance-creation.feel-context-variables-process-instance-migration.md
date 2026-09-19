# Process instance creation — FEEL context variables — Process instance migration

When a process instance with a business ID is [migrated](https://docs.camunda.io/docs/next/components/concepts/process-instance-migration) to a different process definition, the business ID is preserved and carried over to the **target** process definition. The business ID remains immutable; it cannot be changed or removed as part of the migration. After migration, the **source** process definition is no longer associated with the business ID.

Migration intentionally **bypasses uniqueness control checks**, because migration operates on existing instances rather than creating new ones. It is a deliberate operator action with accountability provided by the audit log. As a result:

- Migration is never rejected due to a business ID conflict at the target process definition. The target definition may end up with more than one active root process instance with the same business ID.
- When uniqueness control is enabled, a new process instance with the same business ID can be created for the **source** process definition, since it is no longer associated with the migrated instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
