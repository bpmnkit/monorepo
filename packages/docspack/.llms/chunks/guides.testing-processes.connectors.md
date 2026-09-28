# Testing Processes — Connectors

An outbound connector is a job whose type is the connector's id. Use `mockConnector` with
the response the connector would return. The element's `resultVariable` and
`resultExpression` headers map that response into variables:

```typescript
t.mockConnector("io.camunda:http-json:1", {
  response: { status: 200, body: { main: { temp: 21.5 } } },
})
// resultVariable "weather"          → weather = the whole response
// resultExpression "={temp: body.main.temp}" → temp = 21.5
```

The response's fields are in scope in `resultExpression`, and `response` is too. The
expression must produce a context. A `null` result maps nothing. A handler
`(job) => response` and the `{ fail }` and `{ throwError }` forms also work.
`mapConnectorResponse(response, headers)` is exported if you want the mapping on its own.
`errorExpression` is not evaluated.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
