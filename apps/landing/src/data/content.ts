import { SITE } from "@bpmnkit/astro-shared"
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
// Versions are hand-maintained — update when a package is version-bumped.

export const ECOSYSTEM = [
	{
		name: "@bpmnkit/core",
		version: "0.1.1",
		role: "Author & parse BPMN, DMN, and Forms",
		note: null,
		url: `${SITE.github}/tree/main/packages/core`,
		npm: "https://www.npmjs.com/package/@bpmnkit/core",
	},
	{
		name: "@bpmnkit/engine",
		version: "0.1.29",
		role: "Simulate a process in-process",
		note: "experimental, not a production runtime",
		url: `${SITE.github}/tree/main/packages/engine`,
		npm: "https://www.npmjs.com/package/@bpmnkit/engine",
	},
	{
		name: "@bpmnkit/api",
		version: "0.0.19",
		role: "Deploy & operate on Camunda 8",
		note: null,
		url: `${SITE.github}/tree/main/packages/api`,
		npm: "https://www.npmjs.com/package/@bpmnkit/api",
	},
	{
		name: "@bpmnkit/canvas",
		version: "0.0.29",
		role: "View a diagram (SVG, pan/zoom)",
		note: null,
		url: `${SITE.github}/tree/main/packages/canvas`,
		npm: "https://www.npmjs.com/package/@bpmnkit/canvas",
	},
	{
		name: "@bpmnkit/editor",
		version: "0.0.32",
		role: "Edit a diagram in the browser",
		note: null,
		url: `${SITE.github}/tree/main/packages/editor`,
		npm: "https://www.npmjs.com/package/@bpmnkit/editor",
	},
	{
		name: "casen (CLI)",
		version: "0.0.36",
		role: "Operate Camunda 8 from the terminal",
		note: null,
		url: `${SITE.github}/tree/main/apps/cli`,
		npm: "https://www.npmjs.com/package/@bpmnkit/cli",
	},
] as const

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
