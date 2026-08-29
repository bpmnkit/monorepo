# casen connector — Generate from the OpenAPI catalog

The fastest way to get started. The catalog contains 30 popular APIs with pre-configured spec URLs
and auth defaults:

```sh
# List all available catalog entries
casen connector catalog

# Generate templates for the Stripe API
casen connector generate --api stripe --output ./templates/

# Generate templates for GitHub with a custom ID prefix
casen connector generate --api github --id-prefix com.myorg --output ./templates/
```


## Generate from a local file

Pass any local OpenAPI 3.x or Swagger 2.x file in YAML or JSON format:

```sh
casen connector generate --swagger ./openapi.yaml --output ./templates/

# JSON format works too
casen connector generate --swagger ./api-spec.json --output ./templates/
```

---
Source: https://bpmnkit.com/docs/cli/connector
