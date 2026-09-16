# Compensation events

Compensation events are used to undo tasks that have already been executed.

Compensation events assist with undoing steps that were already successfully completed in the case that their results
are no longer desired and need to be reversed.

To revert the effects of an activity, a compensation boundary event is attached to the activity. This activity is called
**compensation activity**. The compensation boundary event is associated with
the [compensation handler](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler), an activity with a compensation marker that
is in charge of reverting the effects of the compensation activity.

![Process with compensation throw event](assets/compensation-throw-event.png)

The example above shows the execution of compensation events:

1. After the service task `A` is completed, the process reaches the compensation intermediate throw event.
2. This invokes the compensation handler `Undo A` associated with the compensation boundary event.
3. Once the compensation handler `Undo A` is completed, the process completes the compensation intermediate throw event
   and takes the outgoing sequence flow.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events
