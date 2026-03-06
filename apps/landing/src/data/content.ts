// ── Site metadata ──────────────────────────────────────────────────────────────

export const SITE = {
	name: "BPMN SDK",
	tagline: "Generate BPMN diagrams with code",
	description:
		"A TypeScript SDK for generating, editing, and executing BPMN 2.0 diagrams " +
		"programmatically. Designed for AI agents, automation platforms, and Camunda 8 " +
		"/ Zeebe workflow deployments. Zero runtime dependencies in the core packages.",
	url: "https://bpmn-sdk-landing.pages.dev",
	github: "https://github.com/bpmn-sdk/monorepo",
	npm: "https://www.npmjs.com/package/@bpmn-sdk/core",
};

// ── Packages ───────────────────────────────────────────────────────────────────

export const PACKAGES = [
	{
		name: "@bpmn-sdk/core",
		url: `${SITE.github}/tree/main/packages/bpmn-sdk`,
		description:
			"Fluent process builder, BPMN 2.0 parser/serializer, DMN support, " +
			"AI-compact format (compactify/expand), auto-layout (Sugiyama algorithm)",
	},
	{
		name: "@bpmn-sdk/engine",
		url: `${SITE.github}/tree/main/packages/engine`,
		description:
			"Zero-dependency BPMN simulation engine (browser + Node.js) — service tasks, " +
			"user tasks, gateways, timers, message correlation, DMN evaluation",
	},
	{
		name: "@bpmn-sdk/api",
		url: `${SITE.github}/tree/main/packages/api`,
		description:
			"Camunda 8 REST API client — 180 typed methods, 30+ resource classes, " +
			"OAuth2 / Bearer / Basic auth, LRU+TTL cache, exponential backoff, TypedEventEmitter",
	},
	{
		name: "@bpmn-sdk/canvas",
		url: `${SITE.github}/tree/main/packages/canvas`,
		description: "Zero-dependency SVG BPMN viewer with pan/zoom, dark/light theme, plugin API",
	},
	{
		name: "@bpmn-sdk/editor",
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
] as const;

// ── Feature bullets (for llms.txt) ────────────────────────────────────────────

export const FEATURES = [
	"Fluent builder API: chain .startEvent().serviceTask().exclusiveGateway().branch()...",
	"Auto-layout: Sugiyama algorithm produces clean diagrams with no coordinate math",
	"AI-native: compact intermediate format fits an entire diagram in a single LLM prompt",
	"Camunda 8 ready: native Zeebe task definitions, IO mappings, connectors, forms",
	"Roundtrip fidelity: parse → modify → export without data loss",
	"Simulation engine: deploy and run processes locally, register job workers, evaluate DMN",
	"REST API client: full Camunda 8 Orchestration Cluster API coverage",
	"CLI: arrow-key TUI, connection profiles, tabular results",
] as const;

// ── Code examples — plain text (for llms-full.txt) ────────────────────────────

export const CODE = {
	withSdk: `\
import { Bpmn } from "@bpmn-sdk/core";

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
import { Bpmn } from "@bpmn-sdk/core";

const xml = Bpmn.export(
  Bpmn.createProcess("hello")
    .startEvent("start")
    .serviceTask("task", {
      name: "Hello World",
      taskType: "greet",
    })
    .endEvent("end")
    .withAutoLayout()
    .build()
);`,

	deployRun: `\
import { Engine } from "@bpmn-sdk/engine";

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
import { CamundaClient } from "@bpmn-sdk/api";

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
} as const;

// ── Code examples — HTML-highlighted (for index.astro) ────────────────────────
// When you change a code example above, update the matching HTML version here.

export const CODE_HTML = {
	withSdk: `<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;

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

	createProcess: `<span class="kw">import</span> { Bpmn } <span class="kw">from</span> <span class="str">"@bpmn-sdk/core"</span>;

<span class="kw">const</span> xml = Bpmn.export(
  Bpmn.createProcess(<span class="str">"hello"</span>)
    .startEvent(<span class="str">"start"</span>)
    .serviceTask(<span class="str">"task"</span>, {
      name: <span class="str">"Hello World"</span>,
      taskType: <span class="str">"greet"</span>,
    })
    .endEvent(<span class="str">"end"</span>)
    .withAutoLayout()
    .build()
);`,

	deployRun: `<span class="kw">import</span> { Engine } <span class="kw">from</span> <span class="str">"@bpmn-sdk/engine"</span>;

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

	apiClient: `<span class="kw">import</span> { CamundaClient } <span class="kw">from</span> <span class="str">"@bpmn-sdk/api"</span>;

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
} as const;
