import { AI_AGENT_JOB_WORKER_TASK_TYPE, Bpmn, buildAiAgentSubProcess } from "@bpmnkit/core"
import type { AiAgentModelConfig } from "@bpmnkit/core"
import { AI_AGENT_TASK_TYPE, TEMPLATE_API_KEY, TEMPLATE_MODEL, aiTask } from "./ai-task.js"
import type { ProcessTemplate } from "./types.js"

// The patterns below follow Anthropic's "Building effective agents" taxonomy. Each
// model call is an AI Agent Task (one call, no tools); the last two patterns hand a
// set of tools to the AI Agent Sub-process connector, which loops on its own.

/**
 * Turns any connector failure (model limit reached, provider down) into a BPMN
 * error the process can catch, instead of an incident.
 */
const AGENT_FAILED = {
	errorExpression: '=if error != null then bpmnError("AGENT_FAILED", error.message) else null',
}

const MODEL: AiAgentModelConfig = {
	provider: "anthropic",
	inputs: {
		"provider.anthropic.authentication.apiKey": TEMPLATE_API_KEY,
		"provider.anthropic.model.model": TEMPLATE_MODEL,
	},
}

export const aiPromptChaining: ProcessTemplate = {
	id: "ai-prompt-chaining",
	title: "AI Prompt Chaining",
	description:
		"Splits writing an article into three model calls — outline, draft, edit — each fed the previous step's output. Between the first two sits a programmatic gate, a FEEL script that checks the outline before any more tokens are spent; an outline that fails the gate sends the brief back instead of producing a weak article.",
	category: "ai-agents",
	tags: ["ai", "prompt chaining", "ai agent task", "gate", "content"],
	build: () =>
		Bpmn.createProcess("ai-prompt-chaining")
			.name("AI Prompt Chaining")
			.versionTag("1.0.0")
			.startEvent("brief-received", { name: "Brief received" })
			.serviceTask(
				"write-outline",
				aiTask({
					name: "Write outline",
					systemPrompt: "You plan technical articles. Reply with a numbered outline only.",
					userPrompt: '="Outline an article for this brief:\\n" + brief',
					outputs: [{ source: "=agent.responseText", target: "outline" }],
				}),
			)
			.scriptTask("check-outline", {
				name: "Check outline",
				expression: '=string length(outline) >= 40 and contains(outline, "1.")',
				resultVariable: "outlineOk",
			})
			.exclusiveGateway("gate", { name: "Outline passes?" })
			.branch("pass", (b) =>
				b
					.condition("=outlineOk")
					.serviceTask(
						"write-draft",
						aiTask({
							name: "Write draft",
							systemPrompt: "You write clear technical articles from an outline.",
							userPrompt: '="Write the article for this outline:\\n" + outline',
							outputs: [{ source: "=agent.responseText", target: "draft" }],
						}),
					)
					.serviceTask(
						"edit-draft",
						aiTask({
							name: "Edit for tone and length",
							systemPrompt: "You are a copy editor. Tighten the text; keep the facts.",
							userPrompt: "=draft",
							outputs: [{ source: "=agent.responseText", target: "article" }],
						}),
					)
					.serviceTask("publish-article", {
						name: "Save to CMS as draft",
						taskType: "cms-draft-save",
						ioMapping: { outputs: [{ source: "=url", target: "articleUrl" }] },
					})
					.endEvent("article-ready", { name: "Article ready" }),
			)
			.branch("fail", (b) =>
				b
					.defaultFlow()
					.serviceTask("return-brief", {
						name: "Return brief to requester",
						taskType: "requester-notify",
						taskHeaders: { template: "brief-unclear" },
					})
					.endEvent("brief-returned", { name: "Brief returned" }),
			)
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "article-written",
			name: "The outline passes the gate and the article is written",
			inputs: { brief: "Why idempotent job workers matter" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: {
							responseText: "1. Retries happen\n2. Side effects\n3. Idempotency keys\n4. Summary",
						},
					},
				},
				"cms-draft-save": { outputs: { url: "https://cms.example.com/drafts/9" } },
			},
			expect: {
				path: ["write-outline", "check-outline", "write-draft", "edit-draft", "article-ready"],
				variables: { outlineOk: true, articleUrl: "https://cms.example.com/drafts/9" },
			},
		},
		{
			id: "gate-fails",
			name: "A one-line outline fails the gate",
			inputs: { brief: "?" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: { outputs: { agent: { responseText: "I need more detail." } } },
				"requester-notify": {},
			},
			expect: {
				path: ["write-outline", "check-outline", "return-brief", "brief-returned"],
				variables: { outlineOk: false },
			},
		},
	],
}

export const aiRouting: ProcessTemplate = {
	id: "ai-routing",
	title: "AI Routing",
	description:
		"Classifies each incoming support message with one model call that returns JSON, then sends it down a path built for that kind of request: billing questions look the invoice up before a model drafts the answer, technical ones get a model prompted for troubleshooting, and anything else goes to a person. All paths finish at the same reply step.",
	category: "ai-agents",
	tags: ["ai", "routing", "ai agent task", "json output", "customer support"],
	build: () =>
		Bpmn.createProcess("ai-routing")
			.name("AI Routing")
			.versionTag("1.0.0")
			.startEvent("message-received", { name: "Support message received" })
			.serviceTask(
				"classify",
				aiTask({
					name: "Classify request",
					systemPrompt:
						'Classify support messages. Reply with JSON: {"category": "billing" | "technical" | "other"}.',
					userPrompt: "=message",
					responseFormat: "json",
					outputs: [{ source: "=agent.responseJson.category", target: "category" }],
				}),
			)
			.exclusiveGateway("route", { name: "Category?" })
			.branch("billing", (b) =>
				b
					.condition('=category = "billing"')
					.serviceTask("lookup-invoice", {
						name: "Look up invoice",
						taskType: "billing-invoice-lookup",
						ioMapping: { outputs: [{ source: "=invoice", target: "invoice" }] },
					})
					.serviceTask(
						"draft-billing-reply",
						aiTask({
							name: "Draft billing reply",
							systemPrompt: "You answer billing questions using only the invoice data given.",
							userPrompt: '="Question: " + message + "\\nInvoice: " + string(invoice)',
							outputs: [{ source: "=agent.responseText", target: "reply" }],
						}),
					)
					.connectTo("send-reply"),
			)
			.branch("technical", (b) =>
				b
					.condition('=category = "technical"')
					.serviceTask(
						"draft-technical-reply",
						aiTask({
							name: "Draft troubleshooting reply",
							systemPrompt: "You are a support engineer. Give numbered troubleshooting steps.",
							userPrompt: "=message",
							outputs: [{ source: "=agent.responseText", target: "reply" }],
						}),
					)
					.connectTo("send-reply"),
			)
			.branch("other", (b) =>
				b
					.defaultFlow()
					.userTask("answer-manually", {
						name: "Answer manually",
						zeebeUserTask: true,
						candidateGroups: "support",
					})
					.connectTo("send-reply"),
			)
			.serviceTask("send-reply", {
				name: "Send reply",
				taskType: "email-send",
				ioMapping: { inputs: [{ source: "=reply", target: "body" }] },
			})
			.endEvent("replied", { name: "Replied" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "billing",
			name: "A billing question is answered from the invoice",
			inputs: { message: "Why was I charged twice in March?" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: {
							responseJson: { category: "billing" },
							responseText: "The second charge was a pre-authorisation and has been released.",
						},
					},
				},
				"billing-invoice-lookup": { outputs: { invoice: { id: "INV-3", total: 49 } } },
				"email-send": {},
			},
			expect: {
				path: [
					"classify",
					"route",
					"lookup-invoice",
					"draft-billing-reply",
					"send-reply",
					"replied",
				],
				variables: { category: "billing" },
			},
		},
		{
			id: "other",
			name: "A request that fits no route goes to a person",
			inputs: { message: "Can I visit your office?" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: { outputs: { agent: { responseJson: { category: "other" } } } },
				userTask: { outputs: { reply: "Of course — see the address below." } },
				"email-send": {},
			},
			expect: { path: ["route", "answer-manually", "send-reply", "replied"] },
		},
	],
}

export const aiParallelization: ProcessTemplate = {
	id: "ai-parallelization",
	title: "AI Parallel Guardrails",
	description:
		"Runs three independent model checks on a drafted customer reply at the same time — personal data, policy and tone — and joins them before a FEEL script combines the votes. A reply every check passes is sent; one that any check flags waits for a human reviewer. Sectioning the checks keeps each prompt small and the latency that of the slowest call.",
	category: "ai-agents",
	tags: ["ai", "parallelization", "guardrails", "parallel gateway", "voting"],
	build: () =>
		Bpmn.createProcess("ai-parallelization")
			.name("AI Parallel Guardrails")
			.versionTag("1.0.0")
			.startEvent("reply-drafted", { name: "Reply drafted" })
			.parallelGateway("fan-out")
			.branch("pii", (b) =>
				b.serviceTask(
					"check-pii",
					aiTask({
						name: "Check for personal data",
						systemPrompt:
							'Does the text reveal personal data? Reply with JSON: {"flagged": boolean}.',
						userPrompt: "=reply",
						responseFormat: "json",
						outputs: [{ source: "=agent.responseJson.flagged", target: "piiFlagged" }],
					}),
				),
			)
			.branch("policy", (b) =>
				b.serviceTask(
					"check-policy",
					aiTask({
						name: "Check refund policy",
						systemPrompt:
							'Does the text promise anything the refund policy forbids? Reply with JSON: {"flagged": boolean}.',
						userPrompt: "=reply",
						responseFormat: "json",
						outputs: [{ source: "=agent.responseJson.flagged", target: "policyFlagged" }],
					}),
				),
			)
			.branch("tone", (b) =>
				b.serviceTask(
					"check-tone",
					aiTask({
						name: "Rate tone",
						systemPrompt:
							'Rate the politeness of the text from 1 to 5. Reply with JSON: {"score": number}.',
						userPrompt: "=reply",
						responseFormat: "json",
						outputs: [{ source: "=agent.responseJson.score", target: "toneScore" }],
					}),
				),
			)
			.parallelGateway("fan-in")
			.scriptTask("combine-votes", {
				name: "Combine votes",
				expression: "=piiFlagged or policyFlagged or toneScore < 3",
				resultVariable: "flagged",
			})
			.exclusiveGateway("flagged-gw", { name: "Flagged?" })
			.branch("review", (b) =>
				b
					.condition("=flagged")
					.userTask("human-review", {
						name: "Review flagged reply",
						zeebeUserTask: true,
						candidateGroups: "support-leads",
					})
					.connectTo("send-reply"),
			)
			.branch("clean", (b) => b.defaultFlow().connectTo("send-reply"))
			.serviceTask("send-reply", {
				name: "Send reply",
				taskType: "email-send",
				ioMapping: { inputs: [{ source: "=reply", target: "body" }] },
			})
			.endEvent("reply-sent", { name: "Reply sent" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "all-clear",
			name: "All three checks pass and the reply is sent",
			inputs: { reply: "Thanks for waiting — your replacement ships today." },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: { agent: { responseJson: { flagged: false, score: 5 } } },
				},
				"email-send": {},
			},
			expect: {
				path: ["fan-out", "fan-in", "combine-votes", "send-reply", "reply-sent"],
				variables: { flagged: false },
			},
		},
		{
			id: "flagged",
			name: "A flagged reply waits for a human",
			inputs: { reply: "Your card 4111 1111 1111 1111 was refunded twice." },
			mocks: {
				[AI_AGENT_TASK_TYPE]: { outputs: { agent: { responseJson: { flagged: true, score: 4 } } } },
				userTask: {},
				"email-send": {},
			},
			expect: {
				path: ["combine-votes", "human-review", "send-reply", "reply-sent"],
				variables: { flagged: true },
			},
		},
	],
}

export const aiOrchestratorWorkers: ProcessTemplate = {
	id: "ai-orchestrator-workers",
	title: "AI Orchestrator–Workers",
	description:
		"An orchestrator agent breaks a research question into subtasks it cannot know in advance and hands each to a worker. It is an AI Agent Sub-process whose tools are themselves model calls — a web researcher, a source summariser and a data analyst — whose instructions the orchestrator writes with fromAi(). A report the orchestrator is not confident in goes to an expert before publishing.",
	category: "ai-agents",
	tags: ["ai", "orchestrator-workers", "ai agent sub-process", "ad-hoc sub-process", "fromAi"],
	build: () => {
		const worker = (name: string, systemPrompt: string) =>
			aiTask({ name, systemPrompt, userPrompt: "", outputs: [] })
		const orchestrator = buildAiAgentSubProcess({
			id: "orchestrator",
			name: "Orchestrator",
			model: MODEL,
			systemPrompt:
				'You lead a research team. Break the question into subtasks, delegate each to the best worker, and write the final report from their results. Finish with JSON: {"report": string, "confidence": number between 0 and 1}.',
			userPrompt: "=question",
			maxModelCalls: 20,
			extraInputs: {
				"data.response.format.type": "json",
				"data.response.format.parseJson": "=true",
			},
			tools: [
				{
					id: "research-web",
					description: "Search the web and return the most relevant findings with their sources.",
					serviceTask: worker(
						"Research the web",
						"You research topics on the web and cite sources.",
					),
					params: [
						{
							name: "instructions",
							description: "What to research",
							target: "data.userPrompt.prompt",
							required: true,
						},
					],
					resultSource: "=agent.responseText",
				},
				{
					id: "summarise-source",
					description: "Summarise a long source document into key points.",
					serviceTask: worker(
						"Summarise source",
						"You summarise documents into short, factual key points.",
					),
					params: [
						{
							name: "document",
							description: "The text to summarise",
							target: "data.userPrompt.prompt",
							required: true,
						},
					],
					resultSource: "=agent.responseText",
				},
				{
					id: "analyse-data",
					description: "Analyse a table of numbers and describe the trend.",
					serviceTask: worker(
						"Analyse data",
						"You are a data analyst. Describe trends and outliers.",
					),
					params: [
						{
							name: "data",
							description: "The data as CSV",
							target: "data.userPrompt.prompt",
							required: true,
						},
					],
					resultSource: "=agent.responseText",
				},
			],
		})
		return Bpmn.createProcess("ai-orchestrator-workers")
			.name("AI Orchestrator–Workers")
			.versionTag("1.0.0")
			.startEvent("question-received", { name: "Research question received" })
			.adHocSubProcess("orchestrator", orchestrator.content, {
				...orchestrator.options,
				taskHeaders: AGENT_FAILED,
			})
			.withBoundary(
				"orchestrator-failed",
				{ name: "Agent failed", errorCode: "AGENT_FAILED" },
				(b) =>
					b
						.serviceTask("notify-research-failed", {
							name: "Notify requester: no report",
							taskType: "requester-notify",
							taskHeaders: { template: "research-failed" },
						})
						.endEvent("research-failed", { name: "No report" }),
			)
			.exclusiveGateway("confident", { name: "Confident?" })
			.branch("publish", (b) =>
				b.condition("=agent.responseJson.confidence >= 0.7").connectTo("publish-report"),
			)
			.branch("review", (b) =>
				b
					.defaultFlow()
					.userTask("expert-review", {
						name: "Expert review",
						zeebeUserTask: true,
						candidateGroups: "analysts",
					})
					.connectTo("publish-report"),
			)
			.serviceTask("publish-report", {
				name: "Publish report",
				taskType: "wiki-page-publish",
				ioMapping: {
					inputs: [{ source: "=agent.responseJson.report", target: "pageBody" }],
					outputs: [{ source: "=pageUrl", target: "reportUrl" }],
				},
			})
			.endEvent("report-published", { name: "Report published" })
			.withAutoLayout()
			.build()
	},
	scenarios: [
		{
			id: "confident",
			name: "A confident report is published directly",
			inputs: { question: "How did EU heat-pump sales develop since 2020?" },
			mocks: {
				[AI_AGENT_JOB_WORKER_TASK_TYPE]: {
					outputs: { agent: { responseJson: { report: "Sales doubled…", confidence: 0.86 } } },
				},
				"wiki-page-publish": { outputs: { pageUrl: "https://wiki.example.com/heat-pumps" } },
			},
			expect: {
				path: ["orchestrator", "confident", "publish-report", "report-published"],
				variables: { reportUrl: "https://wiki.example.com/heat-pumps" },
			},
		},
		{
			id: "low-confidence",
			name: "A shaky report goes to an expert first",
			inputs: { question: "What will lithium cost in 2030?" },
			mocks: {
				[AI_AGENT_JOB_WORKER_TASK_TYPE]: {
					outputs: { agent: { responseJson: { report: "Hard to say…", confidence: 0.4 } } },
				},
				userTask: {},
				"wiki-page-publish": { outputs: { pageUrl: "https://wiki.example.com/lithium" } },
			},
			expect: { path: ["orchestrator", "expert-review", "publish-report", "report-published"] },
		},
	],
}

export const aiEvaluatorOptimizer: ProcessTemplate = {
	id: "ai-evaluator-optimizer",
	title: "AI Evaluator–Optimizer",
	description:
		"One model call writes, a second grades the result against the brief and explains what to fix, and the feedback goes into the next attempt. The loop ends when the grade reaches 8 of 10; a FEEL counter caps it at three attempts, after which a human editor takes over, so a hard brief cannot burn tokens forever.",
	category: "ai-agents",
	tags: ["ai", "evaluator-optimizer", "loop", "ai agent task", "quality gate"],
	build: () =>
		Bpmn.createProcess("ai-evaluator-optimizer")
			.name("AI Evaluator–Optimizer")
			.versionTag("1.0.0")
			.startEvent("brief-received", { name: "Brief received" })
			.scriptTask("first-attempt", {
				name: "First attempt",
				expression: "=1",
				resultVariable: "attempt",
			})
			.exclusiveGateway("generate-merge")
			.serviceTask(
				"generate",
				aiTask({
					name: "Generate",
					systemPrompt: "You write product descriptions. Apply the reviewer's feedback when given.",
					userPrompt:
						'="Brief: " + brief + "\\nFeedback: " + (if feedback = null then "none yet" else feedback)',
					outputs: [{ source: "=agent.responseText", target: "candidate" }],
				}),
			)
			.serviceTask(
				"evaluate",
				aiTask({
					name: "Evaluate",
					systemPrompt:
						'Grade the text against the brief from 1 to 10. Reply with JSON: {"score": number, "feedback": string}.',
					userPrompt: '="Brief: " + brief + "\\nText: " + candidate',
					responseFormat: "json",
					outputs: [
						{ source: "=agent.responseJson.score", target: "score" },
						{ source: "=agent.responseJson.feedback", target: "feedback" },
					],
				}),
			)
			.exclusiveGateway("good-enough", { name: "Score ≥ 8?" })
			.branch("accept", (b) => b.condition("=score >= 8").connectTo("deliver-merge"))
			.branch("retry", (b) =>
				b
					.defaultFlow()
					.exclusiveGateway("attempts-left", { name: "Attempts left?" })
					.branch("again", (a) =>
						a
							.condition("=attempt < 3")
							.scriptTask("next-attempt", {
								name: "Next attempt",
								expression: "=attempt + 1",
								resultVariable: "attempt",
							})
							.connectTo("generate-merge"),
					)
					.branch("human", (h) =>
						h
							.defaultFlow()
							.userTask("human-editor", {
								name: "Human editor takes over",
								zeebeUserTask: true,
								candidateGroups: "editors",
							})
							.connectTo("deliver-merge"),
					),
			)
			.exclusiveGateway("deliver-merge")
			.serviceTask("deliver", {
				name: "Deliver text",
				taskType: "pim-description-update",
				ioMapping: { inputs: [{ source: "=candidate", target: "description" }] },
			})
			.endEvent("delivered", { name: "Delivered" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "accepted",
			name: "The first draft scores 9 and is delivered",
			inputs: { brief: "Waterproof hiking boot, 450 g, recycled upper" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: {
							responseText: "Light, dry and made from recycled yarn…",
							responseJson: { score: 9, feedback: "Good." },
						},
					},
				},
				"pim-description-update": {},
			},
			expect: {
				path: ["generate", "evaluate", "good-enough", "deliver", "delivered"],
				variables: { attempt: 1, score: 9 },
			},
		},
		{
			id: "capped",
			name: "Three low scores hand the text to a human editor",
			inputs: { brief: "Describe the boot in exactly seven words, all rhyming" },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: {
							responseText: "Boots that keep your feet dry.",
							responseJson: { score: 4, feedback: "Not seven rhyming words." },
						},
					},
				},
				userTask: {},
				"pim-description-update": {},
			},
			expect: {
				path: [
					"evaluate",
					"next-attempt",
					"evaluate",
					"next-attempt",
					"evaluate",
					"human-editor",
					"delivered",
				],
				variables: { attempt: 3 },
			},
		},
	],
}

export const aiHumanApprovalGate: ProcessTemplate = {
	id: "ai-human-approval-gate",
	title: "AI Proposal with Human Approval",
	description:
		"Lets a model propose how to resolve a customer complaint but keeps a person in charge of anything costly. The proposal comes back as JSON; small goodwill gestures are executed straight away, while refunds over 100 wait for a support lead who approves or rejects them. Nothing irreversible happens on the model's word alone.",
	category: "ai-agents",
	tags: ["ai", "human-in-the-loop", "approval gate", "ai agent task", "refunds"],
	build: () =>
		Bpmn.createProcess("ai-human-approval-gate")
			.name("AI Proposal with Human Approval")
			.versionTag("1.0.0")
			.startEvent("complaint-received", { name: "Complaint received" })
			.serviceTask(
				"propose-resolution",
				aiTask({
					name: "Propose resolution",
					systemPrompt:
						'You resolve customer complaints within policy. Reply with JSON: {"action": "refund" | "voucher" | "apology", "amount": number, "reason": string}.',
					userPrompt: '="Complaint: " + complaint + "\\nOrder total: " + string(orderTotal)',
					responseFormat: "json",
					outputs: [{ source: "=agent.responseJson", target: "proposal" }],
				}),
			)
			.exclusiveGateway("needs-approval", { name: "Needs approval?" })
			.branch("auto", (b) =>
				b
					.condition('=proposal.action != "refund" or proposal.amount <= 100')
					.connectTo("execute-merge"),
			)
			.branch("approve", (b) =>
				b
					.defaultFlow()
					.userTask("approve-proposal", {
						name: "Approve AI proposal",
						zeebeUserTask: true,
						candidateGroups: "support-leads",
					})
					.exclusiveGateway("approved", { name: "Approved?" })
					.branch("yes", (y) => y.condition("=proposalApproved").connectTo("execute-merge"))
					.branch("no", (n) =>
						n
							.defaultFlow()
							.serviceTask("handoff", {
								name: "Hand off to a human agent",
								taskType: "helpdesk-ticket-assign",
								taskHeaders: { queue: "complaints" },
							})
							.endEvent("handed-off", { name: "Handed off" }),
					),
			)
			.exclusiveGateway("execute-merge")
			.serviceTask("execute-resolution", {
				name: "Execute resolution",
				taskType: "resolution-execute",
				ioMapping: {
					inputs: [
						{ source: "=proposal.action", target: "resolutionAction" },
						{ source: "=proposal.amount", target: "resolutionAmount" },
					],
				},
			})
			.serviceTask("reply-customer", {
				name: "Reply to customer",
				taskType: "email-send",
				ioMapping: { inputs: [{ source: "=proposal.reason", target: "body" }] },
			})
			.endEvent("resolved", { name: "Resolved" })
			.withAutoLayout()
			.build(),
	scenarios: [
		{
			id: "voucher-auto",
			name: "A small voucher is executed without approval",
			inputs: { complaint: "Parcel arrived a day late", orderTotal: 40 },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: {
							responseJson: { action: "voucher", amount: 5, reason: "Sorry for the delay" },
						},
					},
				},
				"resolution-execute": {},
				"email-send": {},
			},
			expect: {
				path: ["propose-resolution", "needs-approval", "execute-resolution", "resolved"],
				variables: { proposal: { action: "voucher", amount: 5, reason: "Sorry for the delay" } },
			},
		},
		{
			id: "refund-rejected",
			name: "A 350 refund is rejected by the support lead",
			inputs: { complaint: "Laptop screen cracked on arrival", orderTotal: 350 },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: { responseJson: { action: "refund", amount: 350, reason: "Damaged" } },
					},
				},
				userTask: { outputs: { proposalApproved: false } },
				"helpdesk-ticket-assign": {},
			},
			expect: { path: ["needs-approval", "approve-proposal", "handoff", "handed-off"] },
		},
		{
			id: "refund-approved",
			name: "A 350 refund is approved and executed",
			inputs: { complaint: "Laptop screen cracked on arrival", orderTotal: 350 },
			mocks: {
				[AI_AGENT_TASK_TYPE]: {
					outputs: {
						agent: { responseJson: { action: "refund", amount: 350, reason: "Damaged" } },
					},
				},
				userTask: { outputs: { proposalApproved: true } },
				"resolution-execute": {},
				"email-send": {},
			},
			expect: { path: ["approve-proposal", "execute-resolution", "reply-customer", "resolved"] },
		},
	],
}

export const aiAgentToolLoop: ProcessTemplate = {
	id: "ai-agent-tool-loop",
	title: "AI Agent with Tools",
	description:
		"A customer-service agent built on Camunda's AI Agent Sub-process connector. The ad-hoc sub-process holds the tools — knowledge-base search, order lookup and ticket creation — and the connector loops: call the model, run the tools it picks, feed the results back, until it answers. The answer is sent when the agent says the case is resolved; otherwise a person takes over.",
	category: "ai-agents",
	tags: ["ai", "ai agent sub-process", "ad-hoc sub-process", "tool calling", "fromAi"],
	build: () => {
		const agent = buildAiAgentSubProcess({
			id: "support-agent",
			name: "Support agent",
			model: MODEL,
			systemPrompt:
				'You are a support agent for an online shop. Use the tools; never guess order data. Finish with JSON: {"answer": string, "resolved": boolean}.',
			userPrompt: "=customerMessage",
			maxModelCalls: 12,
			extraInputs: {
				"data.response.format.type": "json",
				"data.response.format.parseJson": "=true",
			},
			tools: [
				{
					id: "search-kb",
					description: "Search the help centre for articles that answer a question.",
					serviceTask: { name: "Search knowledge base", taskType: "kb-search" },
					params: [{ name: "query", description: "Search terms", target: "query", required: true }],
					resultSource: "=articles",
				},
				{
					id: "lookup-order",
					description: "Get the status, items and tracking link of an order.",
					serviceTask: { name: "Look up order", taskType: "order-lookup" },
					params: [
						{ name: "orderId", description: "The order number", target: "orderId", required: true },
					],
					resultSource: "=order",
				},
				{
					id: "create-ticket",
					description: "Open a ticket for the warehouse team when an order needs manual action.",
					serviceTask: { name: "Create ticket", taskType: "ticket-create" },
					params: [
						{
							name: "summary",
							description: "One-line summary of the problem",
							target: "summary",
							required: true,
						},
					],
					resultSource: "=ticketId",
				},
			],
		})
		return Bpmn.createProcess("ai-agent-tool-loop")
			.name("AI Agent with Tools")
			.versionTag("1.0.0")
			.startEvent("message-received", { name: "Customer message received" })
			.adHocSubProcess("support-agent", agent.content, {
				...agent.options,
				taskHeaders: AGENT_FAILED,
			})
			.withBoundary("agent-failed", { name: "Agent failed", errorCode: "AGENT_FAILED" }, (b) =>
				b
					.serviceTask("queue-for-human", {
						name: "Queue for a person",
						taskType: "helpdesk-ticket-assign",
						taskHeaders: { queue: "support" },
					})
					.endEvent("queued", { name: "Queued for a person" }),
			)
			.exclusiveGateway("resolved-gw", { name: "Resolved?" })
			.branch("answer", (b) =>
				b
					.condition("=agent.responseJson.resolved")
					.serviceTask("send-answer", {
						name: "Send answer",
						taskType: "email-send",
						ioMapping: { inputs: [{ source: "=agent.responseJson.answer", target: "body" }] },
					})
					.endEvent("answered", { name: "Answered" }),
			)
			.branch("handoff", (b) =>
				b
					.defaultFlow()
					.userTask("human-takeover", {
						name: "Take over conversation",
						zeebeUserTask: true,
						candidateGroups: "support",
					})
					.endEvent("handed-over", { name: "Handed to a person" }),
			)
			.withAutoLayout()
			.build()
	},
	scenarios: [
		{
			id: "resolved",
			name: "The agent answers a where-is-my-order question",
			inputs: { customerMessage: "Where is order 1042?" },
			mocks: {
				[AI_AGENT_JOB_WORKER_TASK_TYPE]: {
					outputs: {
						agent: {
							responseJson: { answer: "It ships tomorrow; tracking follows.", resolved: true },
						},
					},
				},
				"email-send": {},
			},
			expect: { path: ["support-agent", "resolved-gw", "send-answer", "answered"] },
		},
		{
			id: "handoff",
			name: "The agent cannot resolve it and hands over",
			inputs: { customerMessage: "I want to speak to a person about a legal matter." },
			mocks: {
				[AI_AGENT_JOB_WORKER_TASK_TYPE]: {
					outputs: { agent: { responseJson: { answer: "", resolved: false } } },
				},
				userTask: {},
			},
			expect: { path: ["support-agent", "human-takeover", "handed-over"] },
		},
	],
}
