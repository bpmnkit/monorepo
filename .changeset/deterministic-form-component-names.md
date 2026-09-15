---
"@bpmnkit/core": minor
---

Form component ids and layout rows are derived from the field, not drawn

`FormBuilder` fills in a `layout` on every component it generates, but both the
component id and the row inside that layout came from `generateId()` — a random
draw, or a counter under `resetIdCounter()`. Neither is a function of the form,
so rebuilding an unchanged form produced a different file every time: every id
and every row moved, and a diff of generated output showed everything changed
while saying nothing about what actually did. The counter is no better for this,
only quieter — it moves the moment a field is inserted, removed or reordered,
renumbering every field after it.

Both values now come from the component itself — a composite key of the enclosing
scope, the component type and the field's own identity, hashed:

```
identity      = the field key, or the text of a static block, or a group's label
scope         = the enclosing form id — or the group's id, for nested children
generated id  = stableToken("Field", [scope, type, identity])
generated row = stableToken("Row", [scope, type, identity, "row"])
```

A rerun is byte-identical and reordering two fields moves nothing but their
order. `scope` keeps the same field key in two different forms — and in two
different groups of one form — from colliding, and the `"row"` namespace keeps a
component's row from ever equalling its id.

The two `null`s in a layout now mean opposite things, and the new
`FormLayoutInput` type documents the asymmetry where callers meet it:

- `row: null` is **not set** and is replaced with a generated row. Renderers
  collapse every `row: null` field into one shared row, so `null` is not trusted
  here as an intentional value.
- `columns: null` **is** intentional — the Camunda default of one field per row —
  and is preserved as given.

A caller-supplied `id` or `layout` still wins, and a partial layout is completed
rather than passed through half-built. `FormComponentBase.layout` stays optional,
because a parsed legacy form genuinely has none.

`stableToken(prefix, segments)` and `compositeKey(segments)` are exported for
anywhere else a deterministic id or grouping token is needed: derive it from the
entity's stable identity plus a distinguishing namespace, never from an array
index, insertion order or a random source.
