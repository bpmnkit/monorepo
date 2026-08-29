# @bpmnkit/connector-gen — Catalog reference

Use `CATALOG` and `getCatalogEntry` to inspect or extend the catalog programmatically:

```typescript
import { CATALOG, getCatalogEntry } from "@bpmnkit/connector-gen"

// List all entries
for (const entry of CATALOG) {
  console.log(entry.id, entry.name, entry.defaultAuth)
}

// Look up one entry
const stripe = getCatalogEntry("stripe")
// → { id: "stripe", name: "Stripe API", url: "...", idPrefix: "io.stripe", defaultAuth: "basic" }
```

### Built-in entries

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

---
Source: https://bpmnkit.com/docs/packages/connector-gen
