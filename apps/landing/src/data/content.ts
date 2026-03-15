// ── Site metadata ──────────────────────────────────────────────────────────────

export const SITE = {
	name: "BPMN Kit",
	tagline: "Generate BPMN diagrams with code",
	description:
		"A TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams " +
		"programmatically. Designed for AI agents, automation platforms, and Camunda 8 " +
		"/ Zeebe workflow deployments. Zero runtime dependencies in the core packages.",
	url: "https://bpmnkit.com",
	github: "https://github.com/bpmnkit/monorepo",
	npm: "https://www.npmjs.com/package/@bpmnkit/core",
}

// ── Packages ───────────────────────────────────────────────────────────────────

export const PACKAGES = [
	{
		name: "@bpmnkit/core",
		url: `${SITE.github}/tree/main/packages/core`,
		description:
			"Fluent process builder, BPMN 2.0 parser/serializer, DMN support, " +
			"AI-compact format (compactify/expand), auto-layout (Sugiyama algorithm), " +
			"SVG export (zero deps, all runtimes). " +
			"Includes 22 TypeScript type guard predicates (isBpmnServiceTask, isBpmnGateway…), " +
			"typed error classes (ParseError, ValidationError — instanceof-catchable), " +
			"and element lookup utilities (findElement, getZeebeExtensions, etc.)",
	},
	{
		name: "@bpmnkit/engine",
		url: `${SITE.github}/tree/main/packages/engine`,
		description:
			"Zero-dependency BPMN simulation engine (browser + Node.js) — service tasks, " +
			"user tasks, gateways, timers, message correlation, DMN evaluation",
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
		description: "Zero-dependency SVG BPMN viewer with pan/zoom, dark/light theme, plugin API",
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

// ── Feature bullets (for llms.txt) ────────────────────────────────────────────

export const FEATURES = [
	"Fluent builder API: chain .startEvent().serviceTask().exclusiveGateway().branch()...",
	"Auto-layout: Sugiyama algorithm produces clean diagrams with no coordinate math",
	"AI-native: compact intermediate format fits an entire diagram in a single LLM prompt",
	"Camunda 8 ready: native Zeebe task definitions, IO mappings, connectors, forms",
	"Roundtrip fidelity: parse → modify → export without data loss",
	"SVG export: generate diagram images from BpmnDefinitions — zero deps, works in Node.js, browser, Deno, Bun",
	"Type guards: 22 predicates (isBpmnServiceTask, isBpmnGateway…) narrow BpmnFlowElement unions at compile time",
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

const engine = new Engine();
await engine.deploy({ bpmn: xml });

engine.registerJobWorker(
  "greet",
  async (job) => {
    console.log("Hello!");
    await job.complete();
  }
);
engine.start("hello");`,

	apiClient: `\
import { CamundaClient } from "@bpmnkit/api";

const client = new CamundaClient({
  baseUrl: "https://api.cloud.camunda.io",
  auth: {
    type: "oauth2",
    clientId:     process.env.CAMUNDA_CLIENT_ID,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET,
    audience:     process.env.CAMUNDA_AUDIENCE,
  },
});

// Deploy a process definition
await client.process.deploy({ resources: [{ content: xml }] });

// Start a new instance
const instance = await client.process.startInstance({
  bpmnProcessId: "my-flow",
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

const xml = Dmn.export(dmnDefs); // ✓ valid DMN 2.0 XML`,

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
// When you change a code example above, update the matching HTML version here.

export const CODE_HTML = {
	withSdk: `<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="kw">const</span> xml = Bpmn.export(
  Bpmn.createProcess(<span class="str">"my-flow"</span>) <span class="comment">// fluent API</span>
    .startEvent(<span class="str">"start"</span>)        <span class="comment">// trigger</span>
    .serviceTask(<span class="str">"task"</span>, {
      name: <span class="str">"Do Something"</span>,
      taskType: <span class="str">"my-worker"</span>,    <span class="comment">// Zeebe type</span>
    })
    .endEvent(<span class="str">"end"</span>)
    .withAutoLayout()            <span class="comment">// Sugiyama</span>
    .build()
);

<span class="comment">// ✓ Valid BPMN 2.0 XML</span>
<span class="comment">// ✓ Auto-layout applied</span>
<span class="comment">// ✓ Zeebe extensions set</span>`,

	createProcess: `<span class="kw">import</span> { Bpmn, exportSvg } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"hello"</span>)
  .<span class="fn">startEvent</span>(<span class="str">"start"</span>)
  .<span class="fn">serviceTask</span>(<span class="str">"task"</span>, {
    name: <span class="str">"Hello World"</span>,
    taskType: <span class="str">"greet"</span>,
  })
  .<span class="fn">endEvent</span>(<span class="str">"end"</span>)
  .<span class="fn">withAutoLayout</span>()
  .<span class="fn">build</span>();

<span class="kw">const</span> xml = Bpmn.<span class="fn">export</span>(defs); <span class="comment">// ✓ BPMN 2.0 XML</span>
<span class="kw">const</span> svg = <span class="fn">exportSvg</span>(defs);   <span class="comment">// ✓ SVG image, zero deps</span>`,

	deployRun: `<span class="kw">import</span> { Engine } <span class="kw">from</span> <span class="str">"@bpmnkit/engine"</span>;

<span class="kw">const</span> engine = <span class="kw">new</span> Engine();
<span class="kw">await</span> engine.deploy({ bpmn: xml });

engine.registerJobWorker(
  <span class="str">"greet"</span>,
  <span class="kw">async</span> (job) => {
    console.log(<span class="str">"Hello!"</span>);
    <span class="kw">await</span> job.complete();
  }
);
engine.start(<span class="str">"hello"</span>);`,

	apiClient: `<span class="kw">import</span> { CamundaClient } <span class="kw">from</span> <span class="str">"@bpmnkit/api"</span>;

<span class="kw">const</span> client = <span class="kw">new</span> CamundaClient({
  baseUrl: <span class="str">"https://api.cloud.camunda.io"</span>,
  auth: {
    type: <span class="str">"oauth2"</span>,
    clientId:     process.env.<span class="fn">CAMUNDA_CLIENT_ID</span>,
    clientSecret: process.env.<span class="fn">CAMUNDA_CLIENT_SECRET</span>,
    audience:     process.env.<span class="fn">CAMUNDA_AUDIENCE</span>,
  },
});

<span class="comment">// Deploy a process definition</span>
<span class="kw">await</span> client.process.<span class="fn">deploy</span>({ resources: [{ content: xml }] });

<span class="comment">// Start a new instance</span>
<span class="kw">const</span> instance = <span class="kw">await</span> client.process.<span class="fn">startInstance</span>({
  bpmnProcessId: <span class="str">"my-flow"</span>,
  variables: { orderId: <span class="str">"ord-123"</span> },
});

<span class="comment">// React to lifecycle events</span>
client.<span class="fn">on</span>(<span class="str">"request"</span>, (e) => console.log(e.method, e.url));
client.<span class="fn">on</span>(<span class="str">"error"</span>,   (e) => metrics.<span class="fn">inc</span>(<span class="str">"api.error"</span>));`,

	dmnTable: `<span class="kw">import</span> { Dmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="comment">// Build a DMN decision table</span>
<span class="kw">const</span> dmnDefs = Dmn.<span class="fn">createDecisionTable</span>(<span class="str">"Eligibility"</span>)
  .<span class="fn">name</span>(<span class="str">"Loan Eligibility"</span>)
  .<span class="fn">input</span>({ label: <span class="str">"Credit Score"</span>, expression: <span class="str">"creditScore"</span>, typeRef: <span class="str">"integer"</span> })
  .<span class="fn">input</span>({ label: <span class="str">"Income"</span>, expression: <span class="str">"income"</span>, typeRef: <span class="str">"number"</span> })
  .<span class="fn">output</span>({ label: <span class="str">"Eligible"</span>, name: <span class="str">"eligible"</span>, typeRef: <span class="str">"boolean"</span> })
  .<span class="fn">output</span>({ label: <span class="str">"Max Amount"</span>, name: <span class="str">"maxAmount"</span>, typeRef: <span class="str">"number"</span> })
  .<span class="fn">rule</span>({ inputs: [<span class="str">"&gt;= 700"</span>, <span class="str">"&gt;= 50000"</span>], outputs: [<span class="str">"true"</span>, <span class="str">"500000"</span>] })
  .<span class="fn">rule</span>({ inputs: [<span class="str">"&gt;= 600"</span>, <span class="str">"&gt;= 30000"</span>], outputs: [<span class="str">"true"</span>, <span class="str">"200000"</span>] })
  .<span class="fn">rule</span>({ inputs: [<span class="str">"-"</span>,       <span class="str">"-"</span>],       outputs: [<span class="str">"false"</span>, <span class="str">"0"</span>] })
  .<span class="fn">build</span>();

<span class="kw">const</span> xml = Dmn.<span class="fn">export</span>(dmnDefs); <span class="comment">// ✓ valid DMN 2.0 XML</span>`,

	formExample: `<span class="kw">import</span> { Form } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="comment">// Scaffold a Camunda form with a specific ID</span>
<span class="kw">const</span> form = Form.<span class="fn">makeEmpty</span>(<span class="str">"ApplicationForm"</span>);
<span class="comment">// extend components array with typed fields:</span>
<span class="comment">// { type: "textfield", key: "applicantName", label: "Applicant Name" }</span>
<span class="comment">// { type: "number",    key: "requestAmount", label: "Requested Amount" }</span>
<span class="comment">// { type: "select",    key: "loanType", label: "Loan Type",</span>
<span class="comment">//   values: [{ label: "Personal", value: "personal" }] }</span>
<span class="comment">// { type: "submit",    label: "Submit Application" }</span>

<span class="kw">const</span> json = Form.<span class="fn">export</span>(form); <span class="comment">// ✓ valid Camunda form JSON</span>`,

	typeGuards: `<span class="kw">import</span> {
  Bpmn, findElement, getZeebeExtensions,
  isBpmnServiceTask, isBpmnGateway,
  ParseError,
} <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="kw">try</span> {
  <span class="kw">const</span> defs = Bpmn.<span class="fn">parse</span>(xml); <span class="comment">// throws ParseError if invalid</span>

  <span class="kw">const</span> el = <span class="fn">findElement</span>(defs, <span class="str">"task1"</span>);
  <span class="kw">if</span> (<span class="fn">isBpmnServiceTask</span>(el)) {
    <span class="comment">// el is BpmnServiceTask ✓ — no cast needed</span>
    <span class="kw">const</span> ext = <span class="fn">getZeebeExtensions</span>(el.extensionElements);
    console.log(ext.taskDefinition?.type); <span class="comment">// "my-worker"</span>
  }

  <span class="kw">if</span> (<span class="fn">isBpmnGateway</span>(el)) {
    console.log(<span class="str">"gateway:"</span>, el.type); <span class="comment">// narrowed to gateway types</span>
  }
} <span class="kw">catch</span> (err) {
  <span class="kw">if</span> (err <span class="kw">instanceof</span> ParseError) {
    <span class="comment">// Typed, instanceof-catchable ✓</span>
    console.error(err.code, err.message);
  }
}`,

	bpmnWithCompanions: `<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmnkit/core"</span>;

<span class="comment">// Process referencing a DMN table and a Camunda Form</span>
<span class="kw">const</span> defs = Bpmn.<span class="fn">createProcess</span>(<span class="str">"loan-application"</span>)
  .<span class="fn">name</span>(<span class="str">"Loan Application"</span>)
  .<span class="fn">startEvent</span>(<span class="str">"start"</span>, { name: <span class="str">"Application Received"</span> })
  .<span class="fn">userTask</span>(<span class="str">"collect-data"</span>, {
    name: <span class="str">"Collect Applicant Data"</span>,
    formId: <span class="str">"ApplicationForm"</span>,   <span class="comment">// ← links Camunda Form</span>
  })
  .<span class="fn">businessRuleTask</span>(<span class="str">"check-eligibility"</span>, {
    name: <span class="str">"Check Eligibility"</span>,
    decisionId: <span class="str">"Eligibility"</span>,    <span class="comment">// ← links DMN table</span>
    resultVariable: <span class="str">"eligibilityResult"</span>,
  })
  .<span class="fn">exclusiveGateway</span>(<span class="str">"gw"</span>, { name: <span class="str">"Eligible?"</span> })
  .<span class="fn">branch</span>(<span class="str">"approved"</span>, b =>
    b.<span class="fn">condition</span>(<span class="str">"= eligibilityResult.eligible"</span>)
     .<span class="fn">serviceTask</span>(<span class="str">"disburse"</span>, { taskType: <span class="str">"disburse-loan"</span> })
     .<span class="fn">endEvent</span>(<span class="str">"end-ok"</span>, { name: <span class="str">"Loan Approved"</span> }))
  .<span class="fn">branch</span>(<span class="str">"rejected"</span>, b =>
    b.<span class="fn">defaultFlow</span>()
     .<span class="fn">serviceTask</span>(<span class="str">"notify"</span>, { taskType: <span class="str">"send-rejection-email"</span> })
     .<span class="fn">endEvent</span>(<span class="str">"end-rejected"</span>, { name: <span class="str">"Rejected"</span> }))
  .<span class="fn">withAutoLayout</span>().<span class="fn">build</span>();`,
} as const
