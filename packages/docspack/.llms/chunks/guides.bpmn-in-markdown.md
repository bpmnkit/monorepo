# BPMN Diagrams in Markdown

Mermaid has no BPMN, and PlantUML's BPMN is a sketch. `@bpmnkit/markdown` fills the gap for
docs-as-code: write a process as a fenced code block, and the build turns it into a real BPMN
diagram — the same renderer, layout engine and shapes as the rest of BPMN Kit, drawn as inline
SVG with no client-side JavaScript.

This page uses it. The diagram below is this block, rendered when the site was built:

````md
```bpmn-compact title="Order fulfilment"
{
  "id": "order-fulfilment",
  "elements": [
    { "id": "received", "type": "startEvent", "name": "Order received" },
    { "id": "check", "type": "serviceTask", "name": "Check stock", "jobType": "check-stock" },
    { "id": "inStock", "type": "exclusiveGateway", "name": "In stock?" },
    { "id": "ship", "type": "serviceTask", "name": "Ship order", "jobType": "ship-order" },
    { "id": "shipped", "type": "endEvent", "name": "Shipped" },
    { "id": "backorder", "type": "userTask", "name": "Back-order items" },
    { "id": "waiting", "type": "endEvent", "name": "Back-ordered" }
  ],
  "flows": [
    { "id": "f1", "from": "received", "to": "check" },
    { "id": "f2", "from": "check", "to": "inStock" },
    { "id": "f3", "from": "inStock", "to": "ship", "condition": "=available" },
    { "id": "f4", "from": "inStock", "to": "backorder", "isDefault": true },
    { "id": "f5", "from": "ship", "to": "shipped" },
    { "id": "f6", "from": "backorder", "to": "waiting" }
  ]
}
```
````

```bpmn-compact title="Order fulfilment"
{
  "id": "order-fulfilment",
  "elements": [
    { "id": "received", "type": "startEvent", "name": "Order received" },
    { "id": "check", "type": "serviceTask", "name": "Check stock", "jobType": "check-stock" },
    { "id": "inStock", "type": "exclusiveGateway", "name": "In stock?" },
    { "id": "ship", "type": "serviceTask", "name": "Ship order", "jobType": "ship-order" },
    { "id": "shipped", "type": "endEvent", "name": "Shipped" },
    { "id": "backorder", "type": "userTask", "name": "Back-order items" },
    { "id": "waiting", "type": "endEvent", "name": "Back-ordered" }
  ],
  "flows": [
    { "id": "f1", "from": "received", "to": "check" },
    { "id": "f2", "from": "check", "to": "inStock" },
    { "id": "f3", "from": "inStock", "to": "ship", "condition": "=available" },
    { "id": "f4", "from": "inStock", "to": "backorder", "isDefault": true },
    { "id": "f5", "from": "ship", "to": "shipped" },
    { "id": "f6", "from": "backorder", "to": "waiting" }
  ]
}
```

```bash
npm install --save-dev @bpmnkit/markdown
```

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
