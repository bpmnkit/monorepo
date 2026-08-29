# @bpmnkit/connector-gen — `CatalogEntry` type

```typescript
interface CatalogEntry {
  id: string
  name: string
  description: string
  url: string           // OpenAPI spec download URL
  idPrefix: string      // suggested reverse-DNS prefix
  defaultAuth: AuthHint
}
```


## CLI

The same functionality is available via `casen connector generate` and `casen connector catalog`.
See the [CLI reference](/docs/cli/connector).

---
Source: https://bpmnkit.com/docs/packages/connector-gen
