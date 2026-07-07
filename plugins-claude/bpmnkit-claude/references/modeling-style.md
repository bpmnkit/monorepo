<!-- EXTRACTED from apps/proxy/src/prompt.ts's Camunda BPMN best-practices block. -->

# BPMN modeling style

Naming and structure conventions to apply whenever a plan step doesn't already have an obvious name. These are business-readability conventions Camunda's own tooling (Modeler, Optimize) assumes — following them makes a generated process read naturally to a human reviewer, not just execute correctly.

## Naming — Tasks / activities

- Use **"Verb Object"** form (infinitive verb + noun): "Verify Invoice", "Send Notification", "Approve Request"
- Avoid vague verbs: never use "Handle", "Process", "Manage", "Do", "Execute" alone
- Sentence case: first letter uppercase, rest lowercase — "Verify invoice", not "Verify Invoice" mid-sentence or "VERIFY INVOICE"

## Naming — Events

- **Start events**: "Object + past participle" — "Order Received", "Payment Initiated", "Application Submitted"
- **End events**: "Object + state" — "Order Fulfilled", "Payment Failed", "Request Rejected", "Customer Onboarded"
- Always give start and end events explicit, meaningful names — never leave a start/end event unnamed

## Naming — Gateways

- Exclusive (XOR) split gateways: phrase as a yes/no question ending in "?" — "Invoice valid?", "Order approved?"
- Label outgoing flows from split gateways with the condition answer: "Yes"/"No", "Approved"/"Rejected", "Low"/"High"
- Join-only gateways (merging flows): **no label** — their semantics are implicit
- Parallel and event-based gateways: **no label**

## Structure — Gateway rules

- Never send more than one incoming sequence flow to a task/event — always use a join gateway first (the plan compiler's implicit-join behavior already does this for you at the end of a branch set; don't fight it by hand-adding a second gateway)
- Split and join are separate concerns: one gateway joins, a different gateway splits — never combine both in one symbol
- Every exclusive gateway split should have a corresponding join gateway downstream (or every branch ends independently, e.g. each branch reaches its own end event)

## Structure — Process shape

- Exactly one start event, at least one end event
- Model left to right — time flows left to right (the plan compiler's auto-layout follows this automatically; you never place elements yourself)
- Emphasize the "happy path": the successful main flow should read as a straight line through the process
- Exception paths and error handling branch off it (via error/timer boundaries), not interleave with it
- Model only business-relevant exceptions; keep technical retry logic (job retries) in the `retries` field, not as visible BPMN branches

## Structure — Flow quality

- Every element must be reachable from the start event — `casen lint` flags unreachable elements as an error
- Every non-end element needs at least one outgoing sequence flow
- Use boundary events for exceptions that interrupt an activity (a payment task failing mid-flight), not a gateway split for the same concern
- Loop-back paths must rejoin via a gateway before re-entering a shared task — never point two flows into an ordinary activity

## What you don't have to think about

Layout (x/y coordinates, edge routing, waypoints) is entirely handled by `casen synth`'s auto-layout — never specify positions. Element IDs, sequence flow IDs, and BPMN DI are generated deterministically from the plan. Your only job is: pick clear names, model the right shape, and let the compiler do the rest.
