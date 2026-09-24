# Process documentation — From Drop

A shared drop has a **Docs** button in its toolbar. It offers the same four choices and needs no
edit rights: anyone who can read a drop can take its documentation away. The drop's BPMN file
(the open tab, or the first BPMN file) is documented together with every DMN and form file in
the drop.


## From the CLI

```sh
casen doc export order.bpmn                                  # order.html, print-ready
casen doc export order.bpmn credit.dmn review.form --format docx
casen doc export order.bpmn --format md --out docs/order.md
```

| Flag | Meaning |
|---|---|
| `--format` | `html` (default), `md` or `docx` |
| `--out` | Output path. Default: the input name with the format's extension |
| `--title` | Document title. Default: the pool or process name |
| `--paper` | `a4` (default) or `letter`, for `docx` |

Any `.dmn` and `.form` files after the BPMN file are documented with it. There is no `--format
pdf`: print the HTML to PDF with a browser, or headless — `chrome --headless
--print-to-pdf=order.pdf order.html`.

---
Source: https://bpmnkit.com/docs/guides/process-documentation
