# Creating readable process models — Recommended practices — Modeling explicitly (3)

**(1)**

You could have modeled this join implicitly by leaving out the gateway and directly connecting the two incoming sequence flows to the subsequent task **Have lunch**. However, explicitly modeling the join better visualizes a block, the joining gateway semantically "belongs" to...

**(2)**

...the earlier split. In case the reader is not interested in the details of dinner preparation but just in having dinner, it's easy to "jump" to the gateway, "closing" that logical part of the model.

This is particularly helpful for models bigger than that example with many such (eventually nested) blocks. Consider the following model, showing two _nested blocks_ of gateways:

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → inclusive gateway "Courses selected?"
    — [Main] exclusive gateway "Main dish selected?"
      — [Pasta] "Cook pasta" → exclusive gateway → inclusive gateway → "Have lunch" → end "Lunch finished"
      — [Steak] "Stir-fry steak" → (back to exclusive gateway)
    — [Salad] "Prepare salad" → (back to inclusive gateway)

**(1)**

Now, you couldn't have modeled this join implicitly, because it's directly followed by an inclusive gateway with very different join semantics. _Consistency_ of joining techniques is another reason why we prefer explicitly joining sequence flows in general.

There are always exceptions to the rule! There are cases in which the readability of models can be _improved_ with _implicit modeling_. So don't be dogmatic about explicit modeling; always aim for the most readable model. The following example shows a case of a model in which splitting and joining points do not form natural "blocks" anyway. In such cases, it can be preferable to make use of _implicit joining_ to improve the overall readability!

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
