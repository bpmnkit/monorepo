# Building Processes — Multi-Instance

Run a task or sub-process once per item in a collection:

```typescript
.serviceTask("notify-all", {
  name: "Notify Each Customer",
  taskType: "send-email",
  multiInstance: {
    parallel: true,                          // false = sequential
    inputCollection: "= customers",
    inputElement: "customer",
    outputCollection: "results",
    outputElement: "= { sent: true, email: customer.email }",
  },
})
```


## Generated IDs

You name every flow node. The builder names everything else, and it derives those names from
the model so that rebuilding an unchanged process produces unchanged BPMN — a diff that shows
only what you actually changed.

A sequence flow is named after the two elements it connects:

```typescript
Bpmn.createProcess("orders")
  .startEvent("start")
  .serviceTask("validate", { taskType: "validate" })
  .endEvent("done")
  .build()
// Flow_start_validate, Flow_validate_done
```

When several flows connect the same pair — the branches of a gateway converging on one join —
each gets a discriminator taken from the branch name, or from its condition when the branch is
unnamed:

```typescript
.exclusiveGateway("gw")
.branch("approved", (b) => b.connectTo("done"))
.branch("rejected", (b) => b.connectTo("done"))
// Flow_gw_gw_join_approved, Flow_gw_gw_join_rejected
```

Because the id comes from the connection rather than from a counter, adding or reordering an
unrelated element leaves the other flows' ids alone. The same is true of root definitions
created from event options — `Message_Order_Received` for `messageName: "Order Received"`, and
likewise `Error_`, `Signal_` and `Escalation_` from the code or name they carry.

Two consequences worth knowing:

- **Ids are only as stable as the elements they name.** Omitting an element id (`.startEvent()`
  with no argument) gets you a generated one that changes on every build, and the flow ids
  around it inherit that. Name the nodes you care about.
- **`defaultFlow` becomes predictable.** Setting a gateway's default by id no longer requires
  knowing a random value: `{ defaultFlow: "Flow_gw_gw_join_rejected" }`. `.branch().defaultFlow()`
  is still the shorter way to say it.

`continueProcess()` never renumbers what the document arrived with: flows the builder did not
create keep their ids, and new ones avoid them.

### Naming a root definition yourself

When the id of a message, error, signal or escalation matters — because a message flow in another
pool, a worker, or a deployed process already refers to it — declare it before the events that
use it:

```typescript
Bpmn.createProcess("orders")
  .message("Msg_OrderReceived", { name: "Order Received" })
  .error("Err_OutOfStock", { code: "OUT_OF_STOCK", name: "Out of stock" })
  .signal("Sig_Cancelled", { name: "Order Cancelled" })
  .escalation("Esc_Review", { code: "NEEDS_REVIEW" })
  .startEvent("start", { messageName: "Order Received" })   // messageRef: Msg_OrderReceived
```

Events still name these by name or code, exactly as before — the declaration only decides the id
they resolve to. Order matters: an event built first declares the definition itself, and
declaring it afterwards under a different id throws rather than leaving two definitions of one
message behind.

---
Source: https://bpmnkit.com/docs/guides/building-processes
