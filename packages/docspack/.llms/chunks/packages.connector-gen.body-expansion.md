# @bpmnkit/connector-gen — Body expansion

By default the request body is a single FEEL `Text` field accepting a JSON expression. With
`expandBody: true`, top-level properties of the request body schema become individual typed input
fields — `String`, `Number`, or `Boolean`:

```typescript
// Default: one body field
generate(spec, { idPrefix: "com.myorg" })
// → body: Text (FEEL expression)

// Expanded: one field per top-level body property
generate(spec, { idPrefix: "com.myorg", expandBody: true })
// → to: String, subject: String, html: String, ...
```

---
Source: https://docs.bpmnkit.com/packages/connector-gen/
