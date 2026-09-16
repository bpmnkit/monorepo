/**
 * AI example — from five Markdown files to a deployable BPMN diagram
 *
 * The whole loop an agent runs, with the three retrieval steps in the order it
 * needs them:
 *
 *   1. index the team's own prose and ask it what the flow actually does
 *   2. ask @bpmnkit/docspack how to turn that into BPMN with this library
 *   3. ask @bpmnkit/camunda-docspack whatever the engine, not the library,
 *      decides — gateway semantics, FEEL, job types
 *
 * Only step 4 needs a model, and the object it returns is a CompactDiagram:
 * about 40 lines of JSON rather than 200 lines of XML. `expand` turns that into
 * a laid-out, exportable model deterministically, which is why a model that has
 * never seen BPMN XML can still produce a valid diagram.
 *
 * The CompactDiagram below is written out rather than generated, so this runs
 * offline in milliseconds with no API key. Everything around it is real.
 *
 * Run: pnpm --filter @bpmnkit/examples ai:bpmn
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Bpmn, expand } from "@bpmnkit/core"
import type { CompactDiagram } from "@bpmnkit/core"
import { answer, buildPack, discoverPacks, indexPacks, loadPack } from "@bpmnkit/docspack"
import { writeFlowDocs } from "./flow-docs.js"

const SOURCE = join("output", "flow-docs")
const PACK = join("output", "flow-corpus")
const OUT = join("output", "order-fulfilment.bpmn")

// ── 1. The team's own prose, indexed ─────────────────────────────────────────

writeFlowDocs(SOURCE)
mkdirSync(PACK, { recursive: true })
writeFileSync(
	join(PACK, "package.json"),
	`${JSON.stringify({ name: "order-fulfilment-corpus", version: "1.0.0", private: true }, null, "\t")}\n`,
)
buildPack({
	source: SOURCE,
	packDir: PACK,
	name: "order-fulfilment-corpus",
	version: "1.0.0",
	documents: ["order-fulfilment-corpus"],
	minTokens: 60,
	maxTokens: 800,
})

const corpus = indexPacks([loadPack(PACK)])

console.log("What the flow does, from the team's own files:")
for (const question of [
	"when does an order need manager approval",
	"what runs in parallel with picking and packing",
	"what happens if the carrier refuses the booking",
]) {
	const [top] = answer(corpus, question, { limit: 1, maxTokens: 600 }).hits
	console.log(`  ? ${question}\n    → ${top?.chunkId ?? "no match"}`)
}

// ── 2/3. The library, and the engine ─────────────────────────────────────────

const packs = discoverPacks().filter((pack) => pack.name.startsWith("@bpmnkit/"))
if (packs.length > 0) {
	const docs = indexPacks(packs)
	console.log("\nWhat the agent reads before writing the diagram:")
	for (const question of [
		"expand a CompactDiagram into BPMN XML",
		"exclusive gateway default flow condition",
	]) {
		const [top] = answer(docs, question, { limit: 1, maxTokens: 900 }).hits
		console.log(`  ? ${question}\n    → ${top?.chunkId ?? "no match"}`)
	}
}

// ── 4. What the model returns ────────────────────────────────────────────────

const compact: CompactDiagram = {
	id: "OrderFulfilmentDefinitions",
	processes: [
		{
			id: "orderFulfilment",
			name: "Order Fulfilment",
			elements: [
				{ id: "orderReceived", type: "startEvent", name: "Order received" },
				{
					id: "screenCustomer",
					type: "serviceTask",
					name: "Screen customer",
					jobType: "screen-customer:1",
					resultVariable: "screening",
				},
				{ id: "blocked", type: "exclusiveGateway", name: "Customer blocked?" },
				{ id: "rejectBlocked", type: "endEvent", name: "Rejected — customer blocked" },
				{ id: "needsApproval", type: "exclusiveGateway", name: "Over 10,000 EUR?" },
				{ id: "approveOrder", type: "userTask", name: "Approve order", formId: "order-approval" },
				{ id: "approved", type: "exclusiveGateway", name: "Approved?" },
				{ id: "rejectApproval", type: "endEvent", name: "Rejected by manager" },
				{ id: "splitWork", type: "parallelGateway", name: "Fulfil and invoice" },
				{ id: "pick", type: "serviceTask", name: "Pick lines", jobType: "pick-lines:1" },
				{ id: "pack", type: "serviceTask", name: "Pack order", jobType: "pack-order:1" },
				{
					id: "raiseInvoice",
					type: "serviceTask",
					name: "Raise invoice",
					jobType: "raise-invoice:1",
				},
				{ id: "joinWork", type: "parallelGateway", name: "Ready to ship" },
				{
					id: "bookCarrier",
					type: "serviceTask",
					name: "Book carrier",
					jobType: "io.camunda:http-json:1",
					taskHeaders: { method: "POST", url: "=carrierApiUrl" },
					resultVariable: "booking",
				},
				{ id: "carrierAccepted", type: "exclusiveGateway", name: "Carrier accepted?" },
				{
					id: "dispatchByHand",
					type: "userTask",
					name: "Book carrier by hand",
					formId: "manual-dispatch",
				},
				{
					id: "notifyCustomer",
					type: "serviceTask",
					name: "Email tracking number",
					jobType: "notify-customer:1",
				},
				{ id: "shipped", type: "endEvent", name: "Order shipped" },
			],
			flows: [
				{ id: "f1", from: "orderReceived", to: "screenCustomer" },
				{ id: "f2", from: "screenCustomer", to: "blocked" },
				{
					id: "f3",
					from: "blocked",
					to: "rejectBlocked",
					name: "blocked",
					condition: "= screening.blocked",
				},
				{ id: "f4", from: "blocked", to: "needsApproval", name: "clear" },
				{
					id: "f5",
					from: "needsApproval",
					to: "approveOrder",
					name: "over 10,000",
					condition: "= total > 10000",
				},
				{ id: "f6", from: "needsApproval", to: "splitWork", name: "at or under" },
				{ id: "f7", from: "approveOrder", to: "approved" },
				{
					id: "f8",
					from: "approved",
					to: "rejectApproval",
					name: "rejected",
					condition: "= not(approval.approved)",
				},
				{ id: "f9", from: "approved", to: "splitWork", name: "approved" },
				{ id: "f10", from: "splitWork", to: "pick" },
				{ id: "f11", from: "pick", to: "pack" },
				{ id: "f12", from: "pack", to: "joinWork" },
				{ id: "f13", from: "splitWork", to: "raiseInvoice" },
				{ id: "f14", from: "raiseInvoice", to: "joinWork" },
				{ id: "f15", from: "joinWork", to: "bookCarrier" },
				{ id: "f16", from: "bookCarrier", to: "carrierAccepted" },
				{
					id: "f17",
					from: "carrierAccepted",
					to: "dispatchByHand",
					name: "refused",
					condition: "= not(booking.accepted)",
				},
				{ id: "f18", from: "dispatchByHand", to: "notifyCustomer" },
				{ id: "f19", from: "carrierAccepted", to: "notifyCustomer", name: "accepted" },
				{ id: "f20", from: "notifyCustomer", to: "shipped" },
			],
		},
	],
}

// ── 5. Deterministic from here on ────────────────────────────────────────────

const definitions = expand(compact)

// The compact form has no field for a gateway's default flow, so a model cannot
// return one however well it understood the documentation it just read. Set it
// on the full model, which does: an exclusive gateway whose conditions are all
// false and which has no default deadlocks at runtime.
const DEFAULTS: Record<string, string> = {
	blocked: "f4",
	needsApproval: "f6",
	approved: "f9",
	carrierAccepted: "f19",
}
for (const process of definitions.processes) {
	for (const element of process.flowElements) {
		const flow = DEFAULTS[element.id]
		if (flow !== undefined && element.type === "exclusiveGateway") element.default = flow
	}
}

const xml = Bpmn.export(definitions)

writeFileSync(OUT, xml)

// Parsing back is the cheap proof that what was written is a diagram and not a
// string that looks like one.
const [process] = Bpmn.parse(xml).processes
console.log(
	`\nWrote ${OUT} — ${process?.flowElements.length ?? 0} elements, ${process?.sequenceFlows.length ?? 0} sequence flows`,
)
