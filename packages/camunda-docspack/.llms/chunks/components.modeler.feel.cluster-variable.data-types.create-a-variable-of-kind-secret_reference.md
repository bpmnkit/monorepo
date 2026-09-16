# Supported data types — Create a variable of kind `SECRET_REFERENCE`

Set `kind` when you create the variable. If you omit `kind`, the variable is created as `JSON`.

```bash
POST /v2/cluster-variables/global
Content-Type: application/json

{
  "name": "PAYMENT_API_CONFIG",
  "kind": "SECRET_REFERENCE",
  "value": {
    "endpoint": "https://api.payment.prod.example.com",
    "apiKey": "camunda.secrets.PAYMENT_API_KEY"
  }
}
```

A variable's kind is fixed at creation. Update requests carry no `kind` field, so updating a `SECRET_REFERENCE`-kind variable keeps its kind and scans the new value for references. To change a variable's kind, delete it and create it again with the kind you want.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/data-types
