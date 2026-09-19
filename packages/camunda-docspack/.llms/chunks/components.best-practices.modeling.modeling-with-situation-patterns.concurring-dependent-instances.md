# Modeling with situation patterns — Concurring dependent instances

You need to process a request, but need to make sure that you don't process several similar requests at the same time.

**Example:** A bank worries about the increasing costs for creditworthiness background checks: "Such a request costs real money, and we often have packages of related business being processed at the same time. So we should at least make sure that if one credit check of a customer is already running, we do not want another credit check for the same customer to be performed at the same time."

### Using message events

Diagram (BPMN):
  start "Credit-worthiness check requested" → service task "Determine active credit-worthiness check for customer" → exclusive gateway "Active instance available?"
    — [No: =not(instanceAvailable)] intermediate throw event "Credit-worthiness check activated" → call activity "Determination of credit-worthiness" → service task "Determine waiting instances" → send task "Inform waiting instances" → exclusive gateway → end "Credit-worthiness checked"
    — [Yes: =instanceAvailable] intermediate catch event "Credit-worthiness determined" → (back to exclusive gateway)

**(1)**

Once an instance passes this event and moves on to the subsequent actual determination of the creditworthiness...

**(2)**

...other instances will determine that there already exists an active instance and wait to be informed by this instance.

**(3)**

When the active instance has determined the creditworthiness, it will move on to inform the waiting instances...

**(4)**

...which will receive a message with a creditworthiness payload and be finished themselves with the needed information.

The model explicitly shows separate steps (_determine_ and _inform_ waiting instances) which you might want to implement more efficiently within one single step doing both semantic steps at once by means of a small piece of programming code.

### Using a timer event

While using timer events can be a feasible approach in case you want to avoid communication between instances, we do not recommend it. For example, one downside is that such solutions cause delays and overhead due to the perdiodical queries and the loop.

Diagram (BPMN):
  start "Credit-worthiness check requested" → service task "Determine active credit-worthiness check for customer" → exclusive gateway "Active instance available?"
    — [No: =not(instanceAvailable)] intermediate throw event "Credit-worthiness check activated" → call activity "Determination of credit-worthiness" → exclusive gateway → end "Credit-worthiness checked"
    — [Yes: =instanceAvailable] intermediate catch event "Credit-worthiness check deferred" → exclusive gateway → service task "Determine active credit-worthiness check for customer" → exclusive gateway "Active instance available?"
      — [No: =not(instanceAvailable)] (back to exclusive gateway)
      — [Yes: =instanceAvailable] (back to exclusive gateway)

**(1)**

Once an instance passes this event and moves on to the subsequent actual determination of the creditworthiness...

**(2)**

...all other instances will go into a wait state for some time, but check periodically, if the active instance is finished.

**(3)**

When the active instance has determined the creditworthiness and finishes...

**(4)**

...all other instances will also finish after some time.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
