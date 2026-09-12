# @bpmnkit/core — Installation — Element catalog

`ELEMENT_TYPE_GROUPS` maps every `BpmnElementType` to one of `event`, `task`, `gateway`,
`container` or `data`, with `allElementTypes()` and `elementTypesInGroup(group)` over it. Tool
schemas and prompts render their type lists from this rather than hard-coding one — a
hand-written list is how the MCP schema came to advertise 18 types while the compact path
accepted 23.

---
Source: https://bpmnkit.com/docs/packages/core
