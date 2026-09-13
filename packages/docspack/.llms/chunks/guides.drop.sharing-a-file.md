# Drop — Share & Co-edit — Sharing a file

Open <https://bpmnkit.com/drop> and drop a file onto the page — the whole page is the
target — or paste one from the clipboard. `.bpmn`, `.dmn` and `.form` are all rendered;
`.xml` and `.json` are accepted and sniffed for the kinds above.

| Limit | Value |
| --- | --- |
| Files per drop | 20 |
| Size of a single file | 900 KB |
| Total per drop | 5 MB |
| Retention | 90 days after the last view or edit |

The share id is 11 base58 characters — about 64 bits, so a drop is unguessable and
unlistable, but it is **not** access-controlled: anyone holding the link can view the
diagram and take a turn editing it. Treat a drop the way you would treat an unlisted link,
not the way you would treat a private repository.

You can also start a drop from a diagram you just drew rather than a file you already had:
the [browser editor](/editor) has **Share as a drop** in its main menu, which uploads the
open diagram through the same endpoint and the same checks.

### From the command line

A drop is a plain HTTP upload, so `curl` works:

```sh
curl -s -X POST https://bpmnkit.com/drop/api/drops \
  -F files=@order-process.bpmn
# → { "shareId": "7Fq2mKd9xTs", "url": "https://bpmnkit.com/drop/7Fq2mKd9xTs", "files": [...] }
```

And the stored file comes back either as uploaded or as the parsed model:

```sh
curl -s https://bpmnkit.com/drop/<shareId>/manifest.json
curl -s "https://bpmnkit.com/drop/<shareId>/f/order-process.bpmn"                # original bytes
curl -s "https://bpmnkit.com/drop/<shareId>/f/order-process.bpmn?format=json"    # @bpmnkit/core model
```

---
Source: https://bpmnkit.com/docs/guides/drop
