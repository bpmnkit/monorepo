# Creating readable process models — Recommended practices — Modeling explicitly (2)

**(2)**

...the subsequent splitting XOR gateway. Of course, BPMN would allow this for other gateway types, too. However, experience shows that readers will often overlook the join semantics of such gateways serving two purposes at the same time.

The fact that readers will often overlook the join semantics of gateways serving to join as well as split the process flow at the same time, combined with the preference for [modeling symmetrically](#modeling-symmetrically), leads us to prefer _splitting and joining gateways modeled with separate symbols_.

However, there are cases in which the readability of models can be improved with _implicit modeling_. Consider the following example:

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

**(1)**

The two incoming sequence flows to the task "Review tweet" could be merged with an XOR gateway, following explicit modeling. We argue that a merging XOR gateway directly behind the start event decreases the readability. A merging XOR gateway is a passive element and the reader expects the process to continue with an active element after the start event.

#### Using XOR gateway markers

Model the XOR gateway by explicitly showing the **X** symbol, even if some tools allow to draw a blank gateway.

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → exclusive gateway "Dish selected?"
    — [Pasta: =choice = "pasta"] "Cook pasta" → exclusive gateway → "Have lunch" → end "Lunch finished"
    — [Steak: =choice = "steak"] "Stir-fry steak" → (back to exclusive gateway)

**(1)**

You could have shown the splitting gateway...

**(2)**

...as well as the joining gateway without the **X** symbol indicating that it is an exclusive gateway.

The **X** marker makes a clearer difference to the other gateway types (inclusive, parallel, event-based, complex) which leads us to prefer _explicit XOR gateway markers_ in general.

#### Splitting sequence flows with parallel gateways

Always model splitting the process flow by explicitly showing the _gateway symbol_:

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → parallel gateway
    — exclusive gateway "Main dish selected?"
      — [Pasta: =choice = "pasta"] "Cook pasta" → exclusive gateway → parallel gateway → "Have lunch" → end "Lunch finished"
      — [Steak: =choice = "steak"] "Stir-fry steak" → (back to exclusive gateway)
    — "Prepare salad" → (back to parallel gateway)

**(1)**

You could have modeled this parallel split implicitly by leaving out the gateway and drawing two outgoing sequence flows out of the preceding task **Choose menu**. However, the reader needs deeper BPMN knowledge in order to understand this model. Additionally, for joining the parallel flows...

**(2)**

...you will always need the explicit symbol.

The fact that readers of models using parallelization will likely need to understand the semantics of a parallel join combined with the preference for modeling symmetrically leads us to prefer _explicit parallel gateways_, too.

#### Joining sequence flows with XOR gateways

Model joining the process flow by explicitly showing the _XOR gateway symbol_ so the reader does not have to know BPMN details to understand how two incoming or outgoing sequence flows in a task behave. Additionally, this often supports the [symmetry of the model](#modeling-symmetrically) by explicitly showing a "relationship" of the splitting and joining _gateways forming a visual "block"_.

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → exclusive gateway "Dish selected?"
    — [Pasta: =choice = "pasta"] "Cook pasta" → exclusive gateway → "Have lunch" → end "Lunch finished"
    — [Steak: =choice = "steak"] "Stir-fry steak" → (back to exclusive gateway)

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
