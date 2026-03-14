export interface CatalogEntry {
	id: string
	name: string
	description: string
	url: string
	/** Suggested id prefix for generated templates */
	idPrefix: string
	/** Default auth hint */
	defaultAuth: "noAuth" | "apiKey" | "basic" | "bearer" | "oauth-client-credentials-flow"
}

export const CATALOG: CatalogEntry[] = [
	{
		id: "github",
		name: "GitHub REST API",
		description: "Manage repos, issues, PRs, actions, and more via the GitHub REST API",
		url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
		idPrefix: "io.github",
		defaultAuth: "bearer",
	},
	{
		id: "cloudflare",
		name: "Cloudflare API",
		description: "Manage DNS, zones, Workers, and other Cloudflare resources",
		url: "https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json",
		idPrefix: "io.cloudflare",
		defaultAuth: "bearer",
	},
	{
		id: "stripe",
		name: "Stripe API",
		description: "Payments, subscriptions, invoices, and more via the Stripe REST API",
		url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
		idPrefix: "io.stripe",
		defaultAuth: "basic",
	},
	{
		id: "notion",
		name: "Notion API",
		description: "Read and write Notion pages, databases, and blocks",
		url: "https://raw.githubusercontent.com/notion-sdk-python/notion-sdk-py/main/openapi.yaml",
		idPrefix: "io.notion",
		defaultAuth: "bearer",
	},
	{
		id: "resend",
		name: "Resend Email API",
		description: "Send transactional emails via the Resend API",
		url: "https://raw.githubusercontent.com/resendlabs/resend-openapi/main/resend.yaml",
		idPrefix: "io.resend",
		defaultAuth: "bearer",
	},
	{
		id: "openai",
		name: "OpenAI API",
		description: "Chat completions, embeddings, images, and more from the OpenAI platform",
		url: "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml",
		idPrefix: "io.openai",
		defaultAuth: "bearer",
	},
	{
		id: "figma",
		name: "Figma API",
		description: "Read and write Figma files, components, comments, and team resources",
		url: "https://raw.githubusercontent.com/figma/rest-api-spec/main/openapi/openapi.yaml",
		idPrefix: "io.figma",
		defaultAuth: "bearer",
	},
	{
		id: "twilio",
		name: "Twilio Messaging API",
		description: "Send and manage SMS, MMS, and WhatsApp messages via Twilio",
		url: "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_messaging_v1.json",
		idPrefix: "io.twilio",
		defaultAuth: "basic",
	},
	{
		id: "slack",
		name: "Slack Web API",
		description: "Post messages, manage channels, users, and workflows in Slack",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/slack.com/1.7.0/openapi.yaml",
		idPrefix: "io.slack",
		defaultAuth: "bearer",
	},
	{
		id: "jira",
		name: "Atlassian Jira API",
		description: "Manage Jira issues, projects, boards, and sprints",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/atlassian.com/jira/1001.0.0-SNAPSHOT/openapi.yaml",
		idPrefix: "io.atlassian.jira",
		defaultAuth: "bearer",
	},
	{
		id: "hubspot",
		name: "HubSpot CRM API",
		description: "Manage contacts, companies, deals, and pipelines in the HubSpot CRM platform",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/hubapi.com/crm/v3/openapi.yaml",
		idPrefix: "com.hubspot",
		defaultAuth: "oauth-client-credentials-flow",
	},
	{
		id: "discord",
		name: "Discord API",
		description: "Manage Discord bots, messages, channels, guilds, and webhooks",
		url: "https://raw.githubusercontent.com/discord/discord-api-spec/main/specs/openapi.json",
		idPrefix: "com.discord",
		defaultAuth: "bearer",
	},
	{
		id: "pagerduty",
		name: "PagerDuty API",
		description: "Create and manage incidents, escalation policies, and on-call schedules",
		url: "https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json",
		idPrefix: "com.pagerduty",
		defaultAuth: "apiKey",
	},
	{
		id: "zoom",
		name: "Zoom API",
		description: "Create and manage Zoom meetings, webinars, recordings, and users",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/zoom.us/2.0.0/openapi.yaml",
		idPrefix: "us.zoom",
		defaultAuth: "oauth-client-credentials-flow",
	},
	{
		id: "mailchimp",
		name: "Mailchimp API",
		description: "Manage email campaigns, audiences, automations, and transactional messages",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/mailchimp.com/3.0.55/openapi.yaml",
		idPrefix: "com.mailchimp",
		defaultAuth: "apiKey",
	},
	{
		id: "asana",
		name: "Asana API",
		description: "Manage tasks, projects, teams, and workspaces in Asana",
		url: "https://raw.githubusercontent.com/Asana/openapi/master/defs/asana_oas.yaml",
		idPrefix: "com.asana",
		defaultAuth: "bearer",
	},
	{
		id: "sendgrid",
		name: "SendGrid Mail API",
		description: "Send transactional and marketing emails with templates, tracking, and analytics",
		url: "https://raw.githubusercontent.com/twilio/sendgrid-oai/main/spec/json/tsg_mail_v3.json",
		idPrefix: "com.sendgrid",
		defaultAuth: "bearer",
	},
	{
		id: "paypal",
		name: "PayPal Payments API",
		description: "Authorize, capture, and refund online payment transactions via PayPal",
		url: "https://raw.githubusercontent.com/paypal/paypal-rest-api-specifications/main/openapi/payments_payment_v2.json",
		idPrefix: "com.paypal",
		defaultAuth: "oauth-client-credentials-flow",
	},
	{
		id: "plaid",
		name: "Plaid API",
		description: "Link bank accounts, read transactions, and verify identity via Plaid",
		url: "https://raw.githubusercontent.com/plaid/plaid-openapi/master/2020-09-14.yml",
		idPrefix: "com.plaid",
		defaultAuth: "apiKey",
	},
	{
		id: "vercel",
		name: "Vercel API",
		description: "Manage Vercel deployments, projects, domains, and team resources",
		url: "https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/vercel.com/0.0.1/openapi.yaml",
		idPrefix: "com.vercel",
		defaultAuth: "bearer",
	},
]

export function getCatalogEntry(id: string): CatalogEntry | undefined {
	return CATALOG.find((e) => e.id === id)
}
