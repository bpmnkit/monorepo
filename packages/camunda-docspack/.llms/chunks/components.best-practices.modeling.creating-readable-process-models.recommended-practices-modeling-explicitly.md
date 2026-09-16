# Creating readable process models — Recommended practices — Modeling explicitly

Make your models easier to understand by modeling _explicitly_, which most often means to either completely avoid certain more "implicit" BPMN constructs, or at least to use them cautiously. Always consider the central _goal of increased readability_ and understandability of the model when deciding whether to model explicitly or implicitly. When in doubt, it's best to favor an explicit style.

#### Using gateways instead of conditional flows

Model splitting the process flow by always using _gateway symbols_ such as  instead of conditional flows .

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → inclusive gateway "Courses selected?"
    — [Main] exclusive gateway "Main dish selected?"
      — [Pasta] "Cook pasta" → exclusive gateway → inclusive gateway → "Have lunch" → end "Lunch finished"
      — [Steak] "Stir-fry steak" → (back to exclusive gateway)
    — [Salad] "Prepare salad" → (back to inclusive gateway)

**(1)**

For example, you could've left out this inclusive gateway by drawing two outgoing sequence flows directly out of the preceding task **Choose menu** and attaching conditions to those sequence flows (becoming conditional sequence flows ). However, experience shows that readers understand the flow semantics of gateways better, which is why we do not make use of this possibility.

#### Modeling start and end events

Model the trigger and the end status of processes by always explicitly showing the _start_ and _end event symbols_.

Diagram (BPMN):
  start "Hunger detected" → "Choose pizza" → "Order pizza" → exclusive gateway → event-based gateway
    — intermediate catch event "Pizza delivered" → "Pay for pizza" → "Eat pizza" → end "Hunger satisfied"
    — intermediate catch event "60 minutes" → "Inquire with pizza service" → (back to exclusive gateway)

**Caution**
Process models without start and end event cannot be executed on the Camunda workflow engine

**(1)**

According to the BPMN standard, you could have left out the start event...

**(2)**

...as long as you also leave out the end events of a process. However, you would have lost important information in your model, which is why we do not make use of this syntactical possibility.

Be specific about the _state_ you reached with your event from a _business perspective_. Quite typically, you will reach "success" and "failure" like events from a business perspective:

Diagram (BPMN):
  start "Invoice to be checked" → "Check invoice" → exclusive gateway "Invoice correct?"
    — [Yes: =correct] "Pay invoice" → end "Invoice paid"
    — [No: =not(correct)] "Reject payment of invoice" → end "Invoice rejected"

**(1)**

'Invoice paid' better qualifies the "successful" business state than e.g. 'Invoice processed' would...

**(2)**

...because in principle, you can call the failed state 'Invoice processed', too, but the reader of the diagram is much better informed by calling it 'Invoice rejected'.

#### Separating splitting and joining gateways

In general, avoid mixing up the split and join semantics of gateways by explicitly showing _two separate symbols_:

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → exclusive gateway "Salad selected?"
    — [Yes: =salad] "Prepare salad" → exclusive gateway → exclusive gateway "Main dish selected?"
      — [Pasta: =choice = "pasta"] "Cook pasta" → exclusive gateway → "Have lunch" → end "Lunch finished"
      — [Steak: =choice = "steak"] "Stir-fry steak" → (back to exclusive gateway)
    — [No: =not(salad)] (back to exclusive gateway)

**(1)**

You could have modeled this join implicitly by leaving out the explicitly joining XOR gateway and directly connecting two incoming sequence flows to...

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
