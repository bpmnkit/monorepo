---
"@bpmnkit/core": minor
---

Writing a model back to a file is now an edit, not a rewrite.

A visual editor serialises the whole model, so saving a diagram used to reformat the file to
this toolkit's output and bury one change in a rewrite of everything. The new writers put the
serialiser's *content* into the file's own *bytes*: what the model changed changes, and
nothing else does. Over sixteen real diagrams, renaming one element is **313 changed lines
with a plain write and 32 with this one**, and opening a file and saving it unchanged is
**0** — byte for byte.

**XML — `preserveFormatting(original, updated, options)` and
`preserveFormattingVerified(original, updated, read)`.** A span-annotated parse of both
documents, a structural diff, and text edits spliced into the original. Indentation,
attribute order, namespace prefixes, comments and processing instructions all survive.
Attribute values are compared *decoded*, so `&#10;` is never rewritten as `&#xA;`; an
inserted element is re-indented by depth to the siblings it lands among.

The two strategies that pay off most are ones no generic XML tool may assume: keeping the
file's own sibling order, and keeping an attribute the serialiser dropped as a schema
default. Whether either is correct is a fact about a *schema*. So `preserveFormattingVerified`
**tries and then checks** — it parses its own output with the caller's reader, compares it to
a plain write, and falls back a rung when they disagree, with the plain write as the floor.
That check is not ceremony: DMN rule order is the decision under hit policy `FIRST`, and it is
what stops the sibling-order strategy silently undoing a deliberate reordering of rules.

**JSON — `preserveJsonFormatting(original, updated)`.** The file's indentation, key order and
trailing newline are kept, and numbers and strings are compared by *value*, so `1.0` is never
rewritten as `1` nor `\u00e9` as `é`. It needs no strategies and no injected reader, because
JSON answers generically what XML cannot: an object is an unordered collection of members and
an array is an ordered sequence (RFC 8259), so key order is always kept, item order always
followed, and deep equality under those rules is an exact statement of "this says what the
update says". The patch checks itself against it.

**Per format**, each supplying its own parser as the check:

- `exportPreserving()` / `exportPreservingResult()` / `preserveBpmnFormatting()` for BPMN
- `exportDmnPreserving()` / `preserveDmnFormatting()` for DMN
- `exportFormPreserving()` / `preserveFormFormatting()` for `.form` files, which are JSON and
  were the worst case: `exportForm` writes `JSON.stringify(…, null, 2)` in its own key order,
  so a form indented with tabs came back with all 109 of its lines rewritten the first time
  anyone touched it. That, and the four-space and minified cases, are all **0** now, and
  relabelling one field changes **one line** whichever way the file is written.

**Also exported**, for a caller that wants the layer underneath: `parseXmlSpans` /
`parseJsonSpans` and their node types, and `escapeAttr` / `escapeText`. The XML parser now
takes an optional `cursor` sink that reports source offsets, off by default so the hot parse
path pays nothing for it.

Every writer falls back to a plain write rather than guessing when the original will not parse
or is a different document entirely, and reports which it did.
