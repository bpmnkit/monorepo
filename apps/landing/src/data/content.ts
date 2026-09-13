import { SITE } from "@bpmnkit/astro-shared"
import { PACKAGE_FACTS } from "../generated/ecosystem"
import type { PackageFact } from "../generated/ecosystem"
import { tokenize } from "../lib/highlight"

// ── Site metadata ──────────────────────────────────────────────────────────────
// Single source of truth — see @bpmnkit/astro-shared. Do not redefine here.
export { SITE }

// ── Packages ───────────────────────────────────────────────────────────────────

export const PACKAGES = [
	{
		name: "@bpmnkit/core",
		url: `${SITE.github}/tree/main/packages/core`,
		description:
			"Fluent process builder, BPMN 2.0 parser/serializer, DMN support, " +
			"AI-compact format (compactify/expand), auto-layout (Sugiyama algorithm), " +
			"SVG export (zero third-party deps, all runtimes). " +
			"Multi-process support: Bpmn.createDiagram() assembles caller/callee process pairs in one definitions document. " +
			"Full branching inside sub-processes (exclusiveGateway, parallelGateway, branch()). " +
			"Ergonomic boundary events via withBoundary() — cursor auto-restores to main flow after the error path. " +
			"Includes 29 TypeScript type guard predicates (isBpmnServiceTask, isBpmnGateway…), " +
			"typed error classes (ParseError, ValidationError — instanceof-catchable), " +
			"and element lookup utilities (findElement, getZeebeExtensions, etc.)",
	},
	{
		name: "@bpmnkit/engine",
		url: `${SITE.github}/tree/main/packages/engine`,
		description:
			"BPMN simulation engine, zero third-party dependencies (browser + Node.js) — " +
			"service tasks, user tasks, gateways, timers, message correlation, DMN evaluation",
	},
	{
		name: "@bpmnkit/api",
		url: `${SITE.github}/tree/main/packages/api`,
		description:
			"Camunda 8 REST API client — 180 typed methods, 30+ resource classes, " +
			"OAuth2 / Bearer / Basic auth, LRU+TTL cache, exponential backoff, TypedEventEmitter",
	},
	{
		name: "@bpmnkit/canvas",
		url: `${SITE.github}/tree/main/packages/canvas`,
		description:
			"Zero-third-party-dependency SVG BPMN viewer with pan/zoom, dark/light theme, plugin API",
	},
	{
		name: "@bpmnkit/editor",
		url: `${SITE.github}/tree/main/packages/editor`,
		description: "Full BPMN editor — canvas + properties panel + AI bridge + storage",
	},
	{
		name: "casen (CLI)",
		url: `${SITE.github}/tree/main/apps/cli`,
		description:
			"Interactive TUI for managing Camunda 8 from the terminal: processes, " +
			"jobs, incidents, decisions, variables, messages",
	},
] as const

// ── Ecosystem map (for the homepage "project status" section) ─────────────────
// Versions, npm URLs and fallback descriptions come from `ecosystem.ts`, which is
// generated from each package's own manifest — nothing here is a number anyone
// has to remember to update. What lives here is the editorial half: which
// packages lead the list, and what each one is *for* rather than what it is.

/** Short "what it is for" line, and the order the leading packages appear in. */
const FEATURED: ReadonlyArray<{ name: string; role: string; note?: string }> = [
	{ name: "@bpmnkit/core", role: "Author & parse BPMN, DMN, and Forms" },
	{
		name: "@bpmnkit/engine",
		role: "Simulate a process in-process",
		note: "experimental, not a production runtime",
	},
	{ name: "@bpmnkit/api", role: "Deploy & operate on Camunda 8" },
	{ name: "@bpmnkit/canvas", role: "View a diagram (SVG, pan/zoom)" },
	{ name: "@bpmnkit/editor", role: "Edit a diagram in the browser" },
	{ name: "@bpmnkit/cli", role: "Operate Camunda 8 from the terminal — the `casen` command" },
]

/** Roles for the rest, where the manifest description is longer than the row. */
const ROLES: Readonly<Record<string, string>> = {
	"@bpmnkit/feel": "Parse & evaluate FEEL expressions",
	"@bpmnkit/plugins": "Composable canvas plugins — minimap, lint, diff, history",
	"@bpmnkit/ascii": "Render a diagram as ASCII art",
	"@bpmnkit/ui": "Brand tokens and theme switching",
	"@bpmnkit/docspack": "These docs, offline and version-locked, for AI agents",
	"@bpmnkit/profiles": "Cluster profiles shared by the CLI and the proxy",
	"@bpmnkit/operate": "Monitoring frontend for a Camunda 8 cluster",
	"@bpmnkit/astro-shared": "Shared site chrome for the BPMN Kit Astro apps",
	"@bpmnkit/connector-gen": "Generate connector templates from OpenAPI specs",
	"@bpmnkit/connectors": "The Camunda 8 out-of-the-box connector catalog",
	"@bpmnkit/patterns": "Domain process patterns for the AI pipeline",
	"@bpmnkit/worker-client": "Thin Zeebe client for standalone workers",
	"@bpmnkit/proxy": "Local AI bridge and Camunda API proxy",
	"@bpmnkit/reebe-wasm": "The Reebe engine, compiled to WebAssembly",
	"@bpmnkit/casen-report": "casen plugin — HTML incident and SLA reports",
	"@bpmnkit/casen-worker-http": "casen plugin — an HTTP connector job worker",
	"@bpmnkit/casen-worker-ai": "casen plugin — classify, summarize and extract",
}

export interface EcosystemEntry {
	readonly name: string
	readonly version: string
	readonly role: string
	readonly note: string | null
	readonly url: string
	readonly npm: string
	/** Leads the homepage list; the rest sit behind "show all". */
	readonly featured: boolean
}

function entry(
	fact: PackageFact,
	role: string | undefined,
	featured: boolean,
	note?: string,
): EcosystemEntry {
	return {
		name: fact.name,
		version: fact.version,
		// A package with no line written for it still renders, with the one its
		// own manifest carries — so adding to PUBLISHED cannot leave a blank row.
		role: role ?? fact.description,
		note: note ?? null,
		url: fact.github,
		npm: fact.npm,
		featured,
	}
}

const byName = new Map(PACKAGE_FACTS.map((fact) => [fact.name, fact]))
const featuredNames = new Set(FEATURED.map((f) => f.name))

export const ECOSYSTEM: readonly EcosystemEntry[] = [
	...FEATURED.flatMap((f) => {
		const fact = byName.get(f.name)
		return fact ? [entry(fact, f.role, true, f.note)] : []
	}),
	...PACKAGE_FACTS.filter((fact) => !featuredNames.has(fact.name)).map((fact) =>
		entry(fact, ROLES[fact.name], false),
	),
]

export const CORE_VERSION = byName.get("@bpmnkit/core")?.version ?? ""

// ── Feature bullets (for llms.txt) ────────────────────────────────────────────

export const FEATURES = [
	"Fluent builder API: chain .startEvent().serviceTask().exclusiveGateway().branch()...",
	"Multi-process definitions: Bpmn.createDiagram(id) assembles multiple processes (caller/callee, sub-flows) into one BPMN definitions document",
	"Sub-process branching: full gateway and branch() support inside subProcess() callbacks, with auto-join insertion",
	"Ergonomic boundary events: .withBoundary(id, options, handler) attaches error/timeout paths and auto-restores the main flow cursor",
	"Auto-layout: Sugiyama algorithm produces clean diagrams with no coordinate math",
	"AI-native: compact intermediate format fits an entire diagram in a single LLM prompt",
	"Camunda 8 ready: native Zeebe task definitions, IO mappings, connectors, forms",
	"Roundtrip fidelity: parse → modify → export without data loss",
	"SVG export: generate diagram images from BpmnDefinitions — zero third-party deps, works in Node.js, browser, Deno, Bun",
	"Type guards: 29 predicates (isBpmnServiceTask, isBpmnGateway…) narrow BpmnFlowElement unions at compile time",
	"Typed errors: ParseError and ValidationError extend a common BpmnSdkError base — all instanceof-catchable with error codes",
	"Element lookup utilities: findElement, findProcess, getZeebeExtensions and friends traverse parsed diagrams",
	"Full JSDoc coverage: @param, @returns, @throws, @example on every public API",
	"Simulation engine: deploy and run processes locally, register job workers, evaluate DMN",
	"REST API client: full Camunda 8 Orchestration Cluster API coverage",
	"CLI: arrow-key TUI, connection profiles, tabular results",
] as const

// ── Code examples — plain text (for llms-full.txt) ────────────────────────────

export const CODE = {
	withSdk: `\
import { Bpmn } from "@bpmnkit/core";

const xml = Bpmn.export(
  Bpmn.createProcess("my-flow") // fluent API
    .startEvent("start")        // trigger
    .serviceTask("task", {
      name: "Do Something",
      taskType: "my-worker",    // Zeebe type
    })
    .endEvent("end")
    .withAutoLayout()           // Sugiyama
    .build()
);

// ✓ Valid BPMN 2.0 XML
// ✓ Auto-layout applied
// ✓ Zeebe extensions set`,

	createProcess: `\
import { Bpmn, exportSvg } from "@bpmnkit/core";

const defs = Bpmn.createProcess("hello")
  .startEvent("start")
  .serviceTask("task", {
    name: "Hello World",
    taskType: "greet",
  })
  .endEvent("end")
  .withAutoLayout()
  .build();

const xml = Bpmn.export(defs); // ✓ BPMN 2.0 XML
const svg = exportSvg(defs);   // ✓ SVG image, zero deps`,

	deployRun: `\
import { Engine } from "@bpmnkit/engine";

// Simulate the process in-process — for tests and local development.
// Deploying to a real Camunda 8 cluster? See the API client below.
const engine = new Engine();
engine.deploy({ bpmn: defs });

engine.registerJobWorker(
  "greet",
  async (job) => {
    console.log("Hello!");
    job.complete();
  }
);
engine.start("hello");`,

	apiClient: `\
import { CamundaClient } from "@bpmnkit/api";

const client = new CamundaClient({
  baseUrl: "https://api.cloud.camunda.io",
  auth: {
    type: "oauth2",
    clientId:     process.env.CAMUNDA_CLIENT_ID!,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET!,
    tokenUrl:     "https://login.cloud.camunda.io/oauth/token",
    audience:     process.env.CAMUNDA_AUDIENCE!,
  },
});

// Start a new instance of an already-deployed process
const instance = await client.processInstance.createProcessInstance({
  processDefinitionId: "my-flow",
  variables: { orderId: "ord-123" },
});

// React to lifecycle events
client.on("request", (e) => console.log(e.method, e.url));
client.on("error",   (e) => metrics.inc("api.error"));`,

	approvalFlow: `\
const xml = Bpmn.export(
  Bpmn.createProcess("approval-flow")
    .startEvent("start", { name: "Request Submitted" })
    .userTask("review", { name: "Review Request" })
    .exclusiveGateway("gw", { name: "Approved?" })
    .branch("yes", (b) =>
      b.condition("= approved")
        .serviceTask("notify", { taskType: "send-email" })
        .endEvent("end-ok")
    )
    .branch("no", (b) => b.defaultFlow().endEvent("end-no"))
    .withAutoLayout()
    .build()
);`,

	withBoundary: `\
const xml = Bpmn.export(
  Bpmn.createProcess("payment-flow")
    .startEvent("start")
    .serviceTask("charge", {
      name: "Charge Card",
      taskType: "payment-charge",
    })
    .withBoundary("on-fail", { errorCode: "PAYMENT_FAILED" }, (p) =>
      p
        .serviceTask("notify", { taskType: "send-email" })
        .endEvent("end-failed"),
    )
    // main flow continues from "charge" — not from boundary
    .serviceTask("fulfill", {
      name: "Fulfill Order",
      taskType: "warehouse-pick",
    })
    .endEvent("end-ok")
    .withAutoLayout()
    .build()
);`,

	parallelGateway: `\
const xml = Bpmn.export(
  Bpmn.createProcess("order-fulfillment")
    .startEvent("start")
    .parallelGateway("split")
    .branch("warehouse", (b) =>
      b.serviceTask("pick", { taskType: "warehouse-pick" })
    )
    .branch("payment", (b) =>
      b.serviceTask("charge", { taskType: "payment-charge" })
    )
    .parallelGateway("join")
    .endEvent("end")
    .withAutoLayout()
    .build()
);`,

	dmnTable: `\
import { Dmn } from "@bpmnkit/core";

// Build a DMN decision table
const dmnDefs = Dmn.createDecisionTable("Eligibility")
  .name("Loan Eligibility")
  .input({ label: "Credit Score", expression: "creditScore", typeRef: "integer" })
  .input({ label: "Income", expression: "income", typeRef: "number" })
  .output({ label: "Eligible", name: "eligible", typeRef: "boolean" })
  .output({ label: "Max Amount", name: "maxAmount", typeRef: "number" })
  .rule({ inputs: [">= 700", ">= 50000"], outputs: ["true", "500000"] })
  .rule({ inputs: [">= 600", ">= 30000"], outputs: ["true", "200000"] })
  .rule({ inputs: ["-",       "-"],       outputs: ["false", "0"] })
  .build();

const xml = Dmn.export(dmnDefs); // ✓ valid DMN 1.3 XML`,

	formExample: `\
import { Form } from "@bpmnkit/core";

// Build a Camunda form from code
const form = Form.makeEmpty("ApplicationForm");
// Forms are JSON-based; extend with fields:
// { type: "textfield", key: "applicantName", label: "Applicant Name" }
// { type: "number",    key: "requestAmount", label: "Requested Amount" }
// { type: "select",    key: "loanType",      label: "Loan Type",
//     values: [{ label: "Personal", value: "personal" },
//              { label: "Business", value: "business" }] }
// { type: "submit",    label: "Submit Application" }

const json = Form.export(form); // ✓ valid Camunda form JSON`,

	typeGuards: `\
import {
  Bpmn, findElement, getZeebeExtensions,
  isBpmnServiceTask, isBpmnGateway,
  ParseError,
} from "@bpmnkit/core";

try {
  const defs = Bpmn.parse(xml); // throws ParseError if invalid

  const el = findElement(defs, "task1");
  if (isBpmnServiceTask(el)) {
    // el is BpmnServiceTask ✓ — no cast needed
    const ext = getZeebeExtensions(el.extensionElements);
    console.log(ext.taskDefinition?.type); // "my-worker"
  }

  if (isBpmnGateway(el)) {
    console.log("gateway:", el.type); // narrowed to gateway types
  }
} catch (err) {
  if (err instanceof ParseError) {
    // Typed, instanceof-catchable ✓
    console.error(err.code, err.message);
  }
}`,

	bpmnWithCompanions: `\
import { Bpmn } from "@bpmnkit/core";

// BPMN process referencing a DMN decision and a Camunda Form
const defs = Bpmn.createProcess("loan-application")
  .name("Loan Application")
  .startEvent("start", { name: "Application Received" })

  // User task linked to a Camunda Form by ID
  .userTask("collect-data", {
    name: "Collect Applicant Data",
    formId: "ApplicationForm",
  })

  // Business rule task evaluated by a DMN table
  .businessRuleTask("check-eligibility", {
    name: "Check Eligibility",
    decisionId: "Eligibility",
    resultVariable: "eligibilityResult",
  })

  .exclusiveGateway("gw", { name: "Eligible?" })
  .branch("approved", (b) =>
    b.condition("= eligibilityResult.eligible")
      .serviceTask("disburse", {
        name: "Disburse Loan",
        taskType: "disburse-loan",
      })
      .endEvent("end-ok", { name: "Loan Approved" }),
  )
  .branch("rejected", (b) =>
    b.defaultFlow()
      .serviceTask("notify", {
        name: "Notify Applicant",
        taskType: "send-rejection-email",
      })
      .endEvent("end-rejected", { name: "Rejected" }),
  )
  .withAutoLayout()
  .build();`,
} as const

// ── Code examples — HTML-highlighted (for index.astro) ────────────────────────
// Generated from CODE above via the shared tokenizer — never hand-edit these.
// This keeps the visible page and llms-full.txt showing the exact same code.

export const CODE_HTML: Record<keyof typeof CODE, string> = Object.fromEntries(
	Object.entries(CODE).map(([key, code]) => [key, tokenize(code)]),
) as Record<keyof typeof CODE, string>
