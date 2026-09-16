# Variables — Input/output variable mappings — Nested variables in mappings

Input and output mappings build nested `target` paths in opposite ways:

- **Input mappings** treat the `target` as a full path and write the entire nested object at that path, replacing any value already there.
- **Output mappings** write only the final property (the leaf) of the `target` path and merge it into the existing structure, preserving sibling properties that are already present.

For example, an input mapping with target `order` replaces the whole `order` variable, while an output mapping with target `order.status` sets only `status` inside an existing `order` variable and leaves its other properties unchanged.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
