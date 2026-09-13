# casen diff

`casen diff bpmn` answers the question a text diff cannot: *what changed about the process?*
Two files go in, and what comes out is the list of elements a reviewer would see differ —
named, not just identified.

```sh
casen diff bpmn old.bpmn new.bpmn
```

```
  + Notify Customer (Activity_1x8fj2)
  ~ Validate Order (Activity_0p2ktn)
  ⇄ Approved? (Gateway_09sd1a)

3 differences: 1 added, 1 changed, 1 moved
```


## Why the categories matter

| Marker | Category | Means |
| --- | --- | --- |
| `+` | added | Exists only in the later file |
| `−` | removed | Exists only in the earlier file |
| `~` | changed | Same element, different semantics — a task type, a condition, an extension |
| `⇄` | moved | Same semantics, different place on the canvas |

`moved` is the category that earns the command. The semantic hash behind
[`diffSemantics()`](/docs/packages/core#diffsemanticsbefore-after) deliberately drops all
diagram interchange — that is what makes it stable across a re-layout — so a task somebody
dragged reads there as no change at all. `casen diff` computes the layout half separately
from DI (bounds, waypoints, label placement, flags such as collapsed/expanded) and reports it
as its own category. An element that changed *and* moved is reported as changed, because a
semantic change is what a reviewer needs first.

Only elements a canvas could actually draw are counted, so a changed `targetNamespace` cannot
inflate the count against nothing on screen. When a diagram has more than one plane, the
per-plane totals are printed too — a change inside a collapsed sub-process is invisible in a
viewer until the reader drills into it.

---
Source: https://bpmnkit.com/docs/cli/diff
