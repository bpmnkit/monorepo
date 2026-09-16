---
"@bpmnkit/feel": minor
"@bpmnkit/core": patch
---

FEEL conformance: 1,939 of the DMN TCK's 2,053 FEEL cases, up from 1,282

The package was compared expression by expression against `@bpmn-io/feelin`, and then
against the DMN TCK itself, which now runs from a dmn-tck checkout via
`pnpm --filter @bpmnkit/feel tck` and weekly in CI.

**This release changes what existing expressions evaluate to.** Where the package was
wrong, it was usually wrong by answering confidently rather than by failing, so expect
results to move:

- String literals decode every escape FEEL defines. `"a\nb"` was the six characters
  `a`, `\`, `n`, `b` and is now a string with a newline in it. Only `\"` and `\\` were
  decoded before.
- Named arguments bind by parameter name instead of by the order they were written, so
  `replace(replacement: "x", pattern: "b", input: "abc")` is `"axc"` rather than `"x"`.
  An argument name the built-in does not declare is now null.
- `and` and `or` follow DMN's ternary logic: a non-boolean operand leaves the result
  unknown, so `true and 123` is null where it was true. Equality across two different
  types is null, so `false = 0` is null where it was false. A condition that used to
  come back true or false may now come back null, which an engine reads as not true.
- Numeric built-ins no longer coerce their arguments, so `sqrt("4")` is null; `number()`
  is the way to convert. Calling a built-in with an argument count no signature accepts
  is null rather than quietly ignoring the extras.
- `**` is left-associative, as FEEL specifies for every infix operator, so `2 ** 3 ** 2`
  is 64 rather than 512.
- `date()` and `time()` reject values no calendar or clock has, and adding months clamps
  the day: `date("2020-01-31") + duration("P1M")` is 2020-02-29, not a February 31st.
- `string(null)` is null rather than the text "null", `count(null)` is null, and
  `string()` renders lists and contexts.

What the package could not do before, and now can: `in` takes a unary test
(`1 in <= 10`, `10 in (1, < 5, >= 10)`); `is()` exists; context entries see the entries
before them (`{a: 1, b: a + 1}`); `for`/`some`/`every` take a range domain
(`for i in 1..3`), each binding's domain sees the bindings to its left, and the body sees
the results so far as `partial`; a function-valued expression can be invoked
(`{f: function(a) a}.f(1)`); a filter condition sees a context element's entries
(`[{a: 1}, {a: 2}][a >= 2]`); time zones resolve to the offset they are on that day;
and names are not limited to ASCII.

Two additions to the API:

- `parseExpression(input, { names })` and `parseUnaryTests(input, { names })` take the
  names in scope, so a variable called `total order amount` parses as one name rather
  than three. Without it, only multi-word built-in names are recognized, as before.
- A `call-expr` AST node represents invoking a function-valued expression. Code that
  switches exhaustively over `FeelNode["kind"]` needs a case for it; `@bpmnkit/core`'s
  FEEL identifier extractor has one.

The 114 TCK cases that remain are listed in the package's `tests/tck.test.ts` with the
reason each is held back. The largest groups belong to the decision model rather than the
expression language — typeRef coercion and external Java functions — followed by XPath
regular expression features V8 does not have. Numbers are compared to a relative 1e-9:
DMN specifies decimal arithmetic to 34 significant digits and this package computes in
float64, which is a deliberate trade for its parse-and-evaluate speed.
