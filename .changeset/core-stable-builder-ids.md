---
"@bpmnkit/core": minor
---

Builder ids are derived from the model instead of generated at random, so
rebuilding an unchanged process produces an unchanged file.

- Sequence flows are `Flow_<source>_<target>`; root definitions are
  `Message_<name>`, `Error_<code>`, `Signal_<name>` and `Escalation_<code>`.
  A diff of a rebuilt document now shows only the edge that actually changed.
- Flows sharing a source/target pair — branches converging on a join — take a
  discriminator from the branch name, or a hash of the condition when the branch
  is unnamed, so the order branches were declared in cannot swap two ids.
- Continuing a parsed document keeps and reserves the ids it was handed, so a
  derived id cannot collide with one. A message two pools both declare is written
  to the collaboration once.
- `ProcessBuilder` can declare root definitions with an id you choose:
  `.message(id, { name })`, `.error(id, { code, name? })`, `.signal(id, { name })`
  and `.escalation(id, { code, name? })`, for when a worker or a deployed process
  already refers to one by an id the builder does not get to pick. Events still
  name them by name or code, so the convenience API is unchanged. Declaring after
  an event has already created that definition throws, naming the id it resolved to.
