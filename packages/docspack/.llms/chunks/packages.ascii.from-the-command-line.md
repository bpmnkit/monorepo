# @bpmnkit/ascii — From the command line

`casen view` wraps all three, picking the renderer from the file extension:

```sh
casen view order.bpmn
casen view risk-score.dmn
```

See [`casen view`](/docs/cli/view) for the flags it adds on top.


## Stability

`@bpmnkit/ascii` carries the [1.0 stability promise](/docs/getting-started/stability): its
exports will not change shape without a major version.

The promise covers the three function signatures and `RenderOptions`. It does **not** cover
the exact characters that come out — box-drawing details, column widths and truncation are
presentation, and improving them is a minor. Do not assert on the rendering byte for byte.

---
Source: https://bpmnkit.com/docs/packages/ascii
