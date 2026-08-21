# @bpmnkit/docspack — Reading it yourself

`search` runs the same query and prints the ranking instead of the content:

```sh
npx bpmnkit-docs search "exclusive gateway condition"
```

```
5 result(s) for "exclusive gateway condition"

  14.73  @bpmnkit/docspack@0.0.1/guides.gateways.exclusive-gateway-xor
        Gateways & Branching — Exclusive Gateway (XOR) · 218 tokens
   8.04  @bpmnkit/docspack@0.0.1/guides.gateways.inclusive-gateway-or
        Gateways & Branching — Inclusive Gateway (OR) · 208 tokens
```

`list` shows which documentation packages were found and whether their manifests agree
with the versions installed.


## Commands

| Command | Purpose |
| --- | --- |
| `bpmnkit-docs ask <question>` | Answer from the installed docs packages — the command to give an agent |
| `bpmnkit-docs search <query>` | Rank matching chunks, for reading in a terminal |
| `bpmnkit-docs list` | Show the docs packages found and their index state |
| `bpmnkit-docs build` | Regenerate the `.llms/` payload from the docs source |

Options: `--limit <n>`, `--max-tokens <n>`, `--pack <name>`, `--cwd <dir>`.

---
Source: https://docs.bpmnkit.com/packages/docspack/
