# casen dev

`casen dev` turns a folder of `.bpmn`, `.dmn` and `.form` files into a local development
environment. It starts a small web server, opens the BPMN Kit editor in your browser, and
re-checks each file every time it changes — whether you saved it in the browser or in another
editor.

```sh
casen dev              # the current folder
casen dev ./processes  # another folder
```

```
  casen dev  /home/me/shop
  UI        http://127.0.0.1:4747/
  files     3 (2 bpmn, 1 dmn, 0 form)
  scenarios @bpmnkit/engine

✖ orders/order.bpmn  lint 0✖ 2⚠  tests 1/2
    FAIL out of stock
      variables.inStock: expected false, got true
✓ orders/refund.bpmn  lint 0✖ 0⚠
✓ risk-score.dmn
  3 files · 1 failing: orders/order.bpmn
  Watching for changes. Ctrl+C to stop.
```

---
Source: https://bpmnkit.com/docs/cli/dev
