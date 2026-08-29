# casen connector — Common workflows

### Preview before writing

Use `--dry-run` to inspect the generated JSON before committing to files:

```sh
casen connector generate --api resend --dry-run
```

### Filter to a subset of operations

Large APIs (GitHub, Stripe) produce hundreds of templates. Use `--filter` to narrow it down:

```sh
# Only generate templates for issue-related operations
casen connector generate --api github --filter "issues" --output ./templates/

# Only POST and PUT operations (filter on summary/operationId)
casen connector generate --api stripe --filter "create|update" --output ./templates/
```

### Expand request body fields

By default the request body is a single FEEL `Text` field. Use `--expand-body` to decompose
top-level properties into individual typed input fields — useful for simple, well-documented APIs:

```sh
casen connector generate --api resend --expand-body --output ./templates/
```

### All templates in one file

```sh
casen connector generate --api slack --format array --output ./templates/
# Writes: ./templates/slack.json  (array of all templates)
```

### Override the base URL

Useful when targeting a self-hosted or staging instance:

```sh
casen connector generate --swagger ./openapi.yaml \
  --base-url https://staging-api.mycompany.com \
  --output ./templates/
```

---
Source: https://bpmnkit.com/docs/cli/connector
