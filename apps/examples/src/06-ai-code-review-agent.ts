/**
 * Example 06 — AI Code Review Agent (agentic use case)
 *
 * Demonstrates:
 * - adHocSubProcess as a Camunda AI agent job worker
 * - Tool service tasks inside the agent (the LLM's callable tools)
 * - Webhook inbound connector as the message start event
 * - Call activity to enrich context before the agent runs
 * - Exclusive gateway routing on agent confidence score
 * - User task fallback for low-confidence reviews
 *
 * The ad-hoc sub-process is the key agentic primitive: the AI agent job
 * worker drives execution inside it, calling whichever tool tasks it needs
 * (in any order, any number of times) until it produces a result.
 */

import { writeFileSync } from "node:fs";
import { Bpmn } from "@bpmn-sdk/core";

// ── Connector icons (base64-encoded SVGs from Camunda marketplace) ────────────

const WEBHOOK_ICON =
	"data:image/svg+xml;base64,PHN2ZyBpZD0naWNvbicgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB3aWR0aD0nMTgnIGhlaWdodD0nMTgnIHZpZXdCb3g9JzAgMCAzMiAzMic+CiAgPGRlZnM+CiAgICA8c3R5bGU+LmNscy0xIHsgZmlsbDogbm9uZTsgfTwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoCiAgICBkPSdNMjQsMjZhMywzLDAsMSwwLTIuODE2NC00SDEzdjFhNSw1LDAsMSwxLTUtNVYxNmE3LDcsMCwxLDAsNi45Mjg3LDhoNi4yNTQ5QTIuOTkxNCwyLjk5MTQsMCwwLDAsMjQsMjZaJy8+CiAgPHBhdGgKICAgIGQ9J00yNCwxNmE3LjAyNCw3LjAyNCwwLDAsMC0yLjU3LjQ4NzNsLTMuMTY1Ni01LjUzOTVhMy4wNDY5LDMuMDQ2OSwwLDEsMC0xLjczMjYuOTk4NWw0LjExODksNy4yMDg1Ljg2ODYtLjQ5NzZhNS4wMDA2LDUuMDAwNiwwLDEsMS0xLjg1MSw2Ljg0MThMMTcuOTM3LDI2LjUwMUE3LjAwMDUsNy4wMDA1LDAsMSwwLDI0LDE2WicvPgogIDxwYXRoCiAgICBkPSdNOC41MzIsMjAuMDUzN2EzLjAzLDMuMDMsMCwxLDAsMS43MzI2Ljk5ODVDMTEuNzQsMTguNDcsMTMuODYsMTQuNzYwNywxMy44OSwxNC43MDhsLjQ5NzYtLjg2ODItLjg2NzctLjQ5N2E1LDUsMCwxLDEsNi44MTItMS44NDM4bDEuNzMxNSwxLjAwMmE3LjAwMDgsNy4wMDA4LDAsMSwwLTEwLjM0NjIsMi4wMzU2Yy0uNDU3Ljc0MjctMS4xMDIxLDEuODcxNi0yLjA3MzcsMy41NzI4WicvPgogIDxyZWN0IGlkPSdfVHJhbnNwYXJlbnRfUmVjdGFuZ2xlXycgZGF0YS1uYW1lPScmbHQ7VHJhbnNwYXJlbnQgUmVjdGFuZ2xlJmd0OycgY2xhc3M9J2Nscy0xJwogICAgd2lkdGg9JzMyJyBoZWlnaHQ9JzMyJy8+Cjwvc3ZnPg==";

const AI_AGENT_ICON =
	"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNBNTZFRkYiLz4KPG1hc2sgaWQ9InBhdGgtMi1vdXRzaWRlLTFfMTg1XzYiIG1hc2tVbml0cz0idXNlclNwYWNlT25Vc2UiIHg9IjQiIHk9IjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgZmlsbD0iYmxhY2siPgo8cmVjdCBmaWxsPSJ3aGl0ZSIgeD0iNCIgeT0iNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ii8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjAuMDEwNSAxMi4wOTg3QzE4LjQ5IDEwLjU4OTQgMTcuMTU5NCA4LjEwODE0IDE2LjE3OTkgNi4wMTEwM0MxNi4xNTIgNi4wMDQ1MSAxNi4xMTc2IDYgMTYuMDc5NCA2QzE2LjA0MTEgNiAxNi4wMDY2IDYuMDA0NTEgMTUuOTc4OCA2LjAxMTA0QzE0Ljk5OTQgOC4xMDgxNCAxMy42Njk3IDEwLjU4ODkgMTIuMTQ4MSAxMi4wOTgxQzEwLjYyNjkgMTMuNjA3MSA4LjEyNTY4IDE0LjkyNjQgNi4wMTE1NyAxNS44OTgxQzYuMDA0NzQgMTUuOTI2MSA2IDE1Ljk2MTEgNiAxNkM2IDE2LjAzODcgNi4wMDQ2OCAxNi4wNzM2IDYuMDExNDQgMTYuMTAxNEM4LjEyNTE5IDE3LjA3MjkgMTAuNjI2MiAxOC4zOTE5IDEyLjE0NzcgMTkuOTAxNkMxMy42Njk3IDIxLjQxMDcgMTQuOTk5NiAyMy44OTIgMTUuOTc5MSAyNS45ODlDMTYuMDA2OCAyNS45OTU2IDE2LjA0MTEgMjYgMTYuMDc5MyAyNkMxNi4xMTc1IDI2IDE2LjE1MTkgMjUuOTk1NCAxNi4xNzk2IDI1Ljk4OUMxNy4xNTkxIDIzLjg5MiAxOC40ODg4IDIxLjQxMSAyMC4wMDk5IDE5LjkwMjFNMjAuMDA5OSAxOS45MDIxQzIxLjUyNTMgMTguMzk4NyAyMy45NDY1IDE3LjA2NjkgMjUuOTkxNSAxNi4wODI0QzI1Ljk5NjUgMTYuMDU5MyAyNiAxNi4wMzEgMjYgMTUuOTk5N0MyNiAxNS45Njg0IDI1Ljk5NjUgMTUuOTQwMyAyNS45OTE1IDE1LjkxNzFDMjMuOTQ3NCAxNC45MzI3IDIxLjUyNTkgMTMuNjAxIDIwLjAxMDUgMTIuMDk4NyIvPgo8L21hc2s+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjAuMDEwNSAxMi4wOTg3QzE4LjQ5IDEwLjU4OTQgMTcuMTU5NCA4LjEwODE0IDE2LjE3OTkgNi4wMTEwM0MxNi4xNTIgNi4wMDQ1MSAxNi4xMTc2IDYgMTYuMDc5NCA2QzE2LjA0MTEgNiAxNi4wMDY2IDYuMDA0NTEgMTUuOTc4OCA2LjAxMTA0QzE0Ljk5OTQgOC4xMDgxNCAxMy42Njk3IDEwLjU4ODkgMTIuMTQ4MSAxMi4wOTgxQzEwLjYyNjkgMTMuNjA3MSA4LjEyNTY4IDE0LjkyNjQgNi4wMTE1NyAxNS44OTgxQzYuMDA0NzQgMTUuOTI2MSA2IDE1Ljk2MTEgNiAxNkM2IDE2LjAzODcgNi4wMDQ2OCAxNi4wNzM2IDYuMDExNDQgMTYuMTAxNEM4LjEyNTE5IDE3LjA3MjkgMTAuNjI2MiAxOC4zOTE5IDEyLjE0NzcgMTkuOTAxNkMxMy42Njk3IDIxLjQxMDcgMTQuOTk5NiAyMy44OTIgMTUuOTc5MSAyNS45ODlDMTYuMDA2OCAyNS45OTU2IDE2LjA0MTEgMjYgMTYuMDc5MyAyNkMxNi4xMTc1IDI2IDE2LjE1MTkgMjUuOTk1NCAxNi4xNzk2IDI1Ljk4OUMxNy4xNTkxIDIzLjg5MiAxOC40ODg4IDIxLjQxMSAyMC4wMDk5IDE5LjkwMjFNMjAuMDA5OSAxOS45MDIxQzIxLjUyNTMgMTguMzk4NyAyMy45NDY1IDE3LjA2NjkgMjUuOTkxNSAxNi4wODI0QzI1Ljk5NjUgMTYuMDU5MyAyNiAxNi4wMzEgMjYgMTUuOTk5N0MyNiAxNS45Njg0IDI1Ljk5NjUgMTUuOTQwMyAyNS45OTE1IDE1LjkxNzFDMjMuOTQ3NCAxNC45MzI3IDIxLjUyNTkgMTMuNjAxIDIwLjAxMDUgMTIuMDk4NyIgZmlsbD0id2hpdGUiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMC4wMTA1IDEyLjA5ODdDMTguNDkgMTAuNTg5NCAxNy4xNTk0IDguMTA4MTQgMTYuMTc5OSA2LjAxMTAzQzE2LjE1MiA2LjAwNDUxIDE2LjExNzYgNiAxNi4wNzk0IDZDMTYuMDQxMSA2IDE2LjAwNjYgNi4wMDQ1MSAxNS45Nzg4IDYuMDExMDRDMTQuOTk5NCA4LjEwODE0IDEzLjY2OTcgMTAuNTg4OSAxMi4xNDgxIDEyLjA5ODFDMTAuNjI2OSAxMy42MDcxIDguMTI1NjggMTQuOTI2NCA2LjAxMTU3IDE1Ljg5ODFDNi4wMDQ3NCAxNS45MjYxIDYgMTUuOTYxMSA2IDE2QzYgMTYuMDM4NyA2LjAwNDY4IDE2LjA3MzYgNi4wMTE0NCAxNi4xMDE0QzguMTI1MTkgMTcuMDcyOSAxMC42MjYyIDE4LjM5MTkgMTIuMTQ3NyAxOS45MDE2QzEzLjY2OTcgMjEuNDEwNyAxNC45OTk2IDIzLjg5MiAxNS45NzkxIDI1Ljk4OUMxNi4wMDY4IDI1Ljk5NTYgMTYuMDQxMSAyNiAxNi4wNzkzIDI2QzE2LjExNzUgMjYgMTYuMTUxOSAyNS45OTU0IDE2LjE3OTYgMjUuOTg5QzE3LjE1OTEgMjMuODkyIDE4LjQ4ODggMjEuNDExIDIwLjAwOTkgMTkuOTAyMU0yMC4wMDk5IDE5LjkwMjFDMjEuNTI1MyAxOC4zOTg3IDIzLjk0NjUgMTcuMDY2OSAyNS45OTE1IDE2LjA4MjRDMjUuOTk2NSAxNi4wNTkzIDI2IDE2LjAzMSAyNiAxNS45OTk3QzI2IDE1Ljk2ODQgMjUuOTk2NSAxNS45NDAzIDI1Ljk5MTUgMTUuOTE3MUMyMy45NDc0IDE0LjkzMjcgMjEuNTI1OSAxMy42MDEgMjAuMDEwNSAxMi4wOTg3IiBzdHJva2U9IiM0OTFEOEIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgbWFzaz0idXJsKCNwYXRoLTItb3V0c2lkZS0xXzE4NV82KSIvPgo8L3N2Zz4K";

const HTTP_JSON_ICON =
	"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3LjAzMzUgOC45OTk5N0MxNy4wMzM1IDEzLjQ0NzUgMTMuNDI4MSAxNy4wNTI5IDguOTgwNjUgMTcuMDUyOUM0LjUzMzE2IDE3LjA1MjkgMC45Mjc3NjUgMTMuNDQ3NSAwLjkyNzc2NSA4Ljk5OTk3QzAuOTI3NzY1IDQuNTUyNDggNC41MzMxNiAwLjk0NzA4MyA4Ljk4MDY1IDAuOTQ3MDgzQzEzLjQyODEgMC45NDcwODMgMTcuMDMzNSA0LjU1MjQ4IDE3LjAzMzUgOC45OTk5N1oiIGZpbGw9IiM1MDU1NjIiLz4KPHBhdGggZD0iTTQuOTMxMjYgMTQuMTU3MUw2Ljc4MTA2IDMuNzE0NzFIMTAuMTM3NUMxMS4xOTE3IDMuNzE0NzEgMTEuOTgyNCAzLjk4MzIzIDEyLjUwOTUgNC41MjAyN0MxMy4wNDY1IDUuMDQ3MzYgMTMuMzE1IDUuNzMzNTggMTMuMzE1IDYuNTc4OTJDMTMuMzE1IDcuNDQ0MTQgMTMuMDcxNCA4LjE1NTIyIDEyLjU4NDEgOC43MTIxNUMxMi4xMDY3IDkuMjU5MTMgMTEuNDU1MyA5LjYzNzA1IDEwLjYyOTggOS44NDU5TDEyLjA2MTkgMTQuMTU3MUgxMC4zMzE1TDkuMDMzNjQgMTAuMDI0OUg3LjI0MzUxTDYuNTEyNTQgMTQuMTU3MUg0LjkzMTI2Wk03LjQ5NzExIDguNTkyODFIOS4yNDI0OEM5Ljk5ODMyIDguNTkyODEgMTAuNTkwMSA4LjQyMzc0IDExLjAxNzcgOC4wODU2MUMxMS40NTUzIDcuNzM3NTMgMTEuNjc0MSA3LjI2NTEzIDExLjY3NDEgNi42Njg0MkMxMS42NzQxIDYuMTkxMDYgMTEuNTI0OSA1LjgxODExIDExLjIyNjUgNS41NDk1OUMxMC45MjgyIDUuMjcxMTMgMTAuNDU1OCA1LjEzMTkgOS44MDkzNiA1LjEzMTlIOC4xMDg3NEw3LjQ5NzExIDguNTkyODFaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K";

// ── Process definition ────────────────────────────────────────────────────────

const definitions = Bpmn.createProcess("AiCodeReviewAgent")
	.withAutoLayout()
	.name("AI Code Review Agent")
	.versionTag("1.0.0")

	// Triggered by a GitHub webhook when a pull request is opened or updated.
	// The inbound webhook connector receives the PR payload and starts the process.
	.startEvent("start", {
		name: "PR Opened / Updated",
		messageName: "github-pr-event",
		zeebeProperties: [
			{ name: "inbound.type", value: "io.camunda:webhook:1" },
			{ name: "inbound.method", value: "POST" },
			{ name: "inbound.context", value: "github-pr" },
			{ name: "inbound.shouldValidateHmac", value: "enabled" },
			{ name: "inbound.hmacSecret", value: "{{secrets.GITHUB_WEBHOOK_SECRET}}" },
			{ name: "inbound.hmacHeader", value: "x-hub-signature-256" },
			{ name: "inbound.hmacAlgorithm", value: "sha256" },
		],
		modelerTemplate: "io.camunda.connectors.webhook.WebhookConnectorStartMessage.v1",
		modelerTemplateVersion: "13",
		modelerTemplateIcon: WEBHOOK_ICON,
	})

	// Fetch the full diff, open comments, and contributor history from GitHub
	// before handing context to the agent. Keeps the agent prompt concise.
	.callActivity("fetchPrContext", {
		name: "Fetch PR Context",
		processId: "FetchGitHubPrContext",
		propagateAllChildVariables: false,
		ioMapping: {
			inputs: [
				{ source: "=pr.repo", target: "repo" },
				{ source: "=pr.number", target: "prNumber" },
			],
			outputs: [
				{ source: "=diff", target: "prDiff" },
				{ source: "=comments", target: "existingComments" },
				{ source: "=contributor", target: "contributorHistory" },
			],
		},
	})

	// ── AI Agent ad-hoc sub-process ───────────────────────────────────────────
	//
	// The Camunda AI agent job worker drives execution inside this sub-process.
	// It decides autonomously which tool tasks to call, in what order, and how
	// many times — looping until it produces a structured review result.
	//
	// Tool tasks declared inside the sub-process are the agent's callable tools:
	//   • fetchFileContent  — retrieve full file content for a given path
	//   • searchCodebase    — search for usages / definitions across the repo
	//   • postDraftComment  — post a draft review comment on a specific line
	//
	.adHocSubProcess(
		"reviewAgent",
		(sub) => {
			// Tool: fetch the raw content of any file in the PR's base branch
			sub.serviceTask("fetchFileContent", {
				name: "Fetch File Content",
				taskType: "io.camunda:http-json:1",
				modelerTemplate: "io.camunda.connectors.HttpJson.v2",
				modelerTemplateVersion: "8",
				modelerTemplateIcon: HTTP_JSON_ICON,
			});

			// Tool: search the repository for a symbol or pattern
			sub.serviceTask("searchCodebase", {
				name: "Search Codebase",
				taskType: "io.camunda:http-json:1",
				modelerTemplate: "io.camunda.connectors.HttpJson.v2",
				modelerTemplateVersion: "8",
				modelerTemplateIcon: HTTP_JSON_ICON,
			});

			// Tool: post a draft inline review comment on a specific diff line
			sub.serviceTask("postDraftComment", {
				name: "Post Draft Comment",
				taskType: "io.camunda:http-json:1",
				modelerTemplate: "io.camunda.connectors.HttpJson.v2",
				modelerTemplateVersion: "8",
				modelerTemplateIcon: HTTP_JSON_ICON,
			});
		},
		{
			name: "AI Code Review Agent",
			// The job worker type that Camunda's agentic AI runtime listens on
			taskDefinition: {
				type: "io.camunda.agenticai:aiagent-job-worker:1",
				retries: "3",
			},
			ioMapping: {
				inputs: [
					// LLM provider — Amazon Bedrock with Claude
					{ source: "bedrock", target: "provider.type" },
					{ source: "us-east-1", target: "provider.bedrock.region" },
					{ source: "credentials", target: "provider.bedrock.authentication.type" },
					{
						source: "{{secrets.AWS_ACCESS_KEY}}",
						target: "provider.bedrock.authentication.accessKey",
					},
					{
						source: "{{secrets.AWS_SECRET_KEY}}",
						target: "provider.bedrock.authentication.secretKey",
					},
					{
						source: "anthropic.claude-3-5-sonnet-20241022-v2:0",
						target: "provider.bedrock.model.model",
					},
					// System prompt — defines the agent's role and review criteria
					{
						source:
							'="You are an expert code reviewer. Analyze the pull request diff for: ' +
							"correctness, security vulnerabilities, performance issues, test coverage, " +
							"and adherence to project conventions. Use your tools to fetch additional " +
							"file content or search for symbol definitions when needed. " +
							'Produce a structured JSON review with: summary, confidence (0-1), issues[], and approved (bool)."',
						target: "data.systemPrompt.prompt",
					},
					// User prompt — the actual PR data
					{
						source:
							"={pr: pr, diff: prDiff, existingComments: existingComments, contributor: contributorHistory}",
						target: "data.userPrompt.prompt",
					},
					// Safety limits to control LLM cost
					{ source: "=20", target: "data.limits.maxModelCalls" },
					{ source: "json", target: "data.response.format.type" },
				],
				outputs: [{ source: "=agent.result", target: "reviewResult" }],
			},
			taskHeaders: {
				elementTemplateVersion: "5",
				elementTemplateId: "io.camunda.connectors.agenticai.aiagent.jobworker.v1",
				retryBackoff: "PT30S",
			},
			// Collect all tool-call results so the agent can reference prior tool outputs
			outputCollection: "toolCallResults",
			outputElement: "={id: toolCall._meta.id, name: toolCall._meta.name, content: toolCallResult}",
			modelerTemplate: "io.camunda.connectors.agenticai.aiagent.jobworker.v1",
			modelerTemplateVersion: "5",
			modelerTemplateIcon: AI_AGENT_ICON,
		},
	)

	// Route on confidence: high-confidence reviews are published automatically;
	// low-confidence ones are handed off to a human reviewer.
	.exclusiveGateway("confidenceGateway", { name: "Confidence ≥ 0.85?" })

	// High confidence: publish the AI review directly to GitHub
	.branch("high-confidence", (b) =>
		b
			.condition("=reviewResult.confidence >= 0.85")
			.serviceTask("publishReview", {
				name: "Publish Review to GitHub",
				taskType: "io.camunda:http-json:1",
				ioMapping: {
					inputs: [
						{
							source: '=githubApiUrl + "/repos/" + pr.repo + "/pulls/" + pr.number + "/reviews"',
							target: "url",
						},
						{ source: "POST", target: "method" },
						{ source: "{{secrets.GITHUB_TOKEN}}", target: "authentication.token" },
						{
							source:
								'={body: reviewResult.summary, event: if reviewResult.approved then "APPROVE" else "REQUEST_CHANGES", comments: reviewResult.issues}',
							target: "body",
						},
					],
				},
				modelerTemplate: "io.camunda.connectors.HttpJson.v2",
				modelerTemplateIcon: HTTP_JSON_ICON,
			})
			.endEvent("endAutoReviewed", { name: "Auto-Review Published" }),
	)

	// Low confidence: assign to a human reviewer with the agent's draft as context
	.branch("low-confidence", (b) =>
		b
			.defaultFlow()
			.userTask("humanReview", {
				name: "Human Review Required",
				formId: "pr-review-form",
				ioMapping: {
					inputs: [
						{ source: "=pr", target: "pr" },
						{ source: "=reviewResult", target: "agentDraft" },
					],
					outputs: [{ source: "=humanDecision", target: "humanDecision" }],
				},
			})
			.serviceTask("publishHumanReview", {
				name: "Publish Human Review to GitHub",
				taskType: "io.camunda:http-json:1",
				ioMapping: {
					inputs: [
						{
							source: '=githubApiUrl + "/repos/" + pr.repo + "/pulls/" + pr.number + "/reviews"',
							target: "url",
						},
						{ source: "POST", target: "method" },
						{ source: "{{secrets.GITHUB_TOKEN}}", target: "authentication.token" },
						{
							source:
								'={body: humanDecision.comment, event: if humanDecision.approved then "APPROVE" else "REQUEST_CHANGES"}',
							target: "body",
						},
					],
				},
				modelerTemplate: "io.camunda.connectors.HttpJson.v2",
				modelerTemplateIcon: HTTP_JSON_ICON,
			})
			.endEvent("endHumanReviewed", { name: "Human Review Published" }),
	)

	.build();

const xml = Bpmn.export(definitions);
writeFileSync("output/06-ai-code-review-agent.bpmn", xml);
console.log("✓ 06-ai-code-review-agent.bpmn");
