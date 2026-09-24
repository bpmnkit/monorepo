# Migrate from Camunda 7 — JUEL to FEEL

The converter translates a JUEL expression only when the result is provably the same. This
means a single `${…}` or `#{…}` that contains only:

- variable paths (`order.customer.vip`),
- string, number, boolean and `null` literals,
- comparisons (`==`, `eq`, `!=`, `ne`, `<`, `lt`, `<=`, `le`, `>`, `gt`, `>=`, `ge`),
- `&&` / `and`, `||` / `or`, `!` / `not`,
- `+`, `-`, `*`, `/`, `div`, and parentheses.

| JUEL | FEEL |
| --- | --- |
| `${approved && order.total <= 1000}` | `=approved and order.total <= 1000` |
| `${status eq 'open'}` | `=status = "open"` |
| `${!approved}` | `=not(approved)` |
| `${nrOfCompletedInstances / nrOfInstances >= 0.6}` (completion condition) | `=numberOfCompletedInstances / numberOfInstances >= 0.6` |

Everything else is kept and reported as `manual`, with the reason. This includes method calls,
`empty`, the `?:` operator, indexing (zero-based in JUEL, one-based in FEEL), `%` (FEEL's
`modulo` uses a different sign rule), the engine objects `execution`, `task` and
`authenticatedUserId`, and text mixed with `${…}`.

"Provable" assumes that the operands are not null. JUEL changes `null` to `false` in boolean
operations, but FEEL keeps it as `null`. For example, `${!approved}` is `true` in Camunda 7
when `approved` is not set. In Camunda 8, `not(approved)` is `null`, so the flow is not taken.
If a variable can be missing, give it a default before the gateway.

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
