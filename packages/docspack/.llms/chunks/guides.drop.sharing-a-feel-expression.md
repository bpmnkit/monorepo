# Drop — Share & Co-edit — Sharing a FEEL expression

A gateway condition or a decision-table entry is unreadable on its own: `order.amount * (1
+ vat)` says nothing until you know what `order` and `vat` were. So a FEEL drop carries
both halves — the expression **and** the context it runs against — and the share page
evaluates them in the reader's browser rather than showing a value you typed in by hand.

Three ways in, all producing the same thing:

- **The composer on [/drop](/drop).** Two boxes and a result that updates as you type,
  then **Get a share link**.
- **The [FEEL playground](/feel-functions).** **Share as a drop** posts whatever is in the
  expression and context boxes.
- **A `.feel` file.** Drop or `curl` it like any other file.

A `.feel` file is either the bare expression:

```text
if risk.score < 40 then "approve" else "refer to underwriting"
```

or a JSON document, which is what the composer and the playground post and what a drop
stores:

```json
{
  "expression": "if risk.score < 40 then \"approve\" else \"refer to underwriting\"",
  "context": { "risk": { "score": 22, "band": "low" } },
  "mode": "expression"
}
```

`mode` is `"expression"` (the default) or `"unary-tests"`. In `unary-tests` mode the
statement is read the way a decision-table input entry is, and the value under test is
whatever the context bound to `?`:

```json
{ "expression": "[18..65]", "context": { "?": 30 }, "mode": "unary-tests" }
```

A bare expression is stored as the document it became, so the **Original** download always
round-trips back through the same parser. Expressions that do not parse are refused at
upload, exactly as unparseable BPMN is — a link that renders a syntax error is not worth
sending.

---
Source: https://bpmnkit.com/docs/guides/drop
