---
title: casen connector
description: Browse the bundled Camunda 8 connector catalog, or generate connector element templates from OpenAPI specs, via the casen CLI.
---

`casen connector` has two independent jobs: **browse** the 116 bundled Camunda 8 out-of-the-box
connector templates (`search`/`show` — used by the AI generation pipeline to wire a plan step to
a real service), and **generate** brand-new connector element templates from OpenAPI 3.x/Swagger
2.x specs (`generate`/`catalog` — for APIs Camunda doesn't ship a template for).

## Commands

```
casen connector
├── search      — find a bundled OOTB connector template by name/keyword
├── show        — show a bundled template's required/optional inputs
├── generate    — generate new templates from an OpenAPI spec file or catalog entry
└── catalog     — list all built-in OpenAPI-catalog entries (for `generate`)
```

## Browse the bundled OOTB catalog

```sh
casen connector search slack
casen connector show io.camunda.connectors.Slack.v1
```

`search` scores the 116 bundled templates by keyword match and prints a table (template id,
direction, task type, description). `show` prints a template's task type, direction, and its
required/optional input keys — these are the keys a `ProcessPlan` `connector` step's `values`
object uses (see [Building Processes with AI](/guides/ai-implement/)):

```
$ casen connector show io.camunda.connectors.Slack.v1
Slack connector  (io.camunda.connectors.Slack.v1)
Task type: io.camunda:slack:1
Direction: outbound
Create a channel or send a message to a channel or user

Required inputs:
  token (secret) — OAuth token
  data.channel — Channel/user name/email
  data.text — Message
  ...
```

A field marked `(secret)` should be supplied as a `{{secrets.NAME}}` placeholder, never a literal
credential. This is the same catalog `@bpmnkit/connectors`' `listConnectors()`/`searchConnectors()`
expose programmatically.

## Generate from the OpenAPI catalog

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

## All flags

| Flag | Description |
|---|---|
| `--swagger <file>` | Path to a local OpenAPI/Swagger YAML or JSON file |
| `--api <id>` | Catalog entry ID — downloads the spec automatically |
| `--output <dir>` | Directory to write `.json` template files into |
| `--base-url <url>` | Override the base URL from the spec |
| `--id-prefix <prefix>` | Reverse-DNS prefix for template IDs (e.g. `com.myorg`) |
| `--filter <regex>` | Filter operations by `operationId` or summary |
| `--expand-body` | Decompose top-level request body properties into individual input fields |
| `--auth <type>` | Pre-select auth type (see below) |
| `--format <fmt>` | `one-per-op` (default) or `array` — all templates in one file |
| `--dry-run` | Print generated templates to stdout instead of writing files |

### Auth types

| Value | Description |
|---|---|
| `noAuth` | No authentication fields |
| `apiKey` | Single API key field sent as a header |
| `basic` | Username + password (HTTP Basic) |
| `bearer` | Bearer token |
| `oauth-client-credentials-flow` | Client ID, secret, token URL, and scopes |

Auth is auto-detected from `components.securitySchemes` in the spec. Use `--auth` to override.

## Common workflows

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

## What gets generated

Each operation in the spec becomes one Camunda element template JSON file. The template
pre-configures a `bpmn:ServiceTask` with job type `io.camunda:http-json:1` and wires up:

- **Method** and **URL** — hidden fixed fields; path parameters become FEEL expressions
  (e.g. `="https://api.example.com/users/"+userId`)
- **Path parameters** — individual `String` input fields
- **Query parameters** — mapped to a FEEL context object
- **Headers** — mapped to a FEEL context object
- **Request body** — single FEEL `Text` field, or individual typed fields with `--expand-body`
- **Authentication** — full 5-type auth block with visibility conditions; pre-selected to the
  detected or specified auth type
- **Output mapping**, **error expression**, **retries**, and **timeout** — standard connector fields

Import the generated `.json` files into Camunda Modeler via
**File → Import Element Templates** or by placing them in your `.camunda/element-templates/` directory.

## Built-in catalog

```sh
casen connector catalog
```

| ID | Name | Default auth |
|---|---|---|
| `github` | GitHub REST API | bearer |
| `cloudflare` | Cloudflare API | bearer |
| `stripe` | Stripe API | basic |
| `notion` | Notion API | bearer |
| `resend` | Resend Email API | bearer |
| `openai` | OpenAI API | bearer |
| `figma` | Figma API | bearer |
| `twilio` | Twilio Messaging API | basic |
| `slack` | Slack Web API | bearer |
| `jira` | Atlassian Jira API | bearer |
| `hubspot` | HubSpot CRM API | oauth-client-credentials-flow |
| `discord` | Discord API | bearer |
| `pagerduty` | PagerDuty API | apiKey |
| `zoom` | Zoom API | oauth-client-credentials-flow |
| `mailchimp` | Mailchimp API | apiKey |
| `asana` | Asana API | bearer |
| `sendgrid` | SendGrid Mail API | bearer |
| `paypal` | PayPal Payments API | oauth-client-credentials-flow |
| `plaid` | Plaid API | apiKey |
| `vercel` | Vercel API | bearer |
| `anthropic` | Anthropic API | apiKey |
| `shopify` | Shopify Admin API | bearer |
| `datadog` | Datadog API | apiKey |
| `sentry` | Sentry API | bearer |
| `intercom` | Intercom API | bearer |
| `contentful` | Contentful Management API | bearer |
| `airtable` | Airtable API | bearer |
| `twitch` | Twitch Helix API | oauth-client-credentials-flow |
| `klaviyo` | Klaviyo API | apiKey |
| `brex` | Brex API | oauth-client-credentials-flow |

## Programmatic usage

The underlying generator is available as a standalone package for use in Node.js scripts and build
pipelines. See [`@bpmnkit/connector-gen`](/packages/connector-gen/).
