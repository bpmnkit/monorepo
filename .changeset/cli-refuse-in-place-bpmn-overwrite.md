---
"@bpmnkit/cli": minor
---

`casen generate bpmn --input <file>` no longer replaces its input by default.

It used to rebuild the file from the compact model and write the result back over the source,
reporting success — which on a real Camunda blueprint silently dropped pools, lanes,
`zeebe:subscription` correlation keys and `ioMapping` detail. The command now:

- applies the patch to the full model, so nothing outside the compact view is lost;
- requires `--output <file>`, or the new `--force` flag to replace the input in place
  (`--output` resolving to the input counts as in place), and names what an in-place write
  costs when it refuses;
- settles the destination **before** reading stdin, so an unwritable target fails immediately
  rather than after the work is done.

Two `--input` examples in the command's help that wrote in place now pass `--output`.
