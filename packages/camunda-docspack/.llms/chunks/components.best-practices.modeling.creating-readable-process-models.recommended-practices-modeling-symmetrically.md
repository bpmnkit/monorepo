# Creating readable process models — Recommended practices — Modeling symmetrically

Try to model symmetrically. Identify related splitting and joining gateways and form easily recognizable _visual_, eventually _nested_, _blocks_ with those gateways.

Diagram (BPMN):
  start "Lunch time" → "Choose menu" → inclusive gateway "Courses selected?"
    — [Main: =list contains(courses, "main")] exclusive gateway "Main dish selected?"
      — [Pasta: =choice = "pasta"] "Cook pasta" → exclusive gateway → inclusive gateway → "Have lunch" → end "Lunch finished"
      — [Steak: =choice = "steak"] "Stir-fry steak" → (back to exclusive gateway)
    — [Salad: =list contains(courses, "salad")] "Prepare salad" → (back to inclusive gateway)

**(1)**

The inclusive gateway splits the process flow into two paths which are ...

**(2)**

... joined again with an inclusive gateway. Inside that block ...

**(3)**

another exclusive gateway splits the process flow into two more paths which are ...

**(4)**

... joined again with an exclusive gateway.

By explicitly showing _pairs of gateways_ "opening" and "closing" parts of the process diagram, and by positioning such gateway pairs _as symmetrically as possible_, the readability of process model is improved. The reader can easily recognize logical parts of the diagram and quickly jump to those parts the reader is momentarily interested in.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
