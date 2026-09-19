# Process instance migration — Correct mistakes in a process instance

Process instance migration can also be used to correct mistakes that led to an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) in a process instance.

Let's consider an example.

A user deployed a process with a user task `A`. The instance of that process always receives two variables (one boolean and one string).
By accident, the string is used in the condition. To fix the problem, the process model should be updated to use the boolean variable instead.
A process instance gets stuck at this user task, and an incident is created to inform the user of this problem.

![After creating the process instance, an incident is created for the service task A.](assets/process-instance-migration/migration-process_instance_with_incident.png)

To correct the problem in the process instance, the user can take the following steps:

1. Correct the mistake in Modeler by creating a new version of the process definition.
2. Deploy the new process version where the boolean variable is used in the condition.
3. Migrate the process instance to the new process version.
4. Resolve the incident.

Afterward, the process instance will continue as expected:

![After migrating the process instance, the input mapping is corrected and the incident is resolved by retry. Afterward, the process instance will continue as expected:](assets/process-instance-migration/migration-process_instance_with_incident_resolved.png)

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
