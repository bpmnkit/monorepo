import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Bpmn, compactify, expand } from "@bpmnkit/core"
import type { CompactDiagram, CompactElement, CompactFlow } from "@bpmnkit/core"
import type { Command, CommandGroup } from "../types.js"

// ── JSON schema reference ─────────────────────────────────────────────────────

const SCHEMA_HELP = `CompactDiagram JSON schema — for --definition and stdin input
==============================================================

TOP-LEVEL
  { "id": "Definitions_<unique>", "processes": [CompactProcess] }

CompactProcess
  { "id": "proc-id", "name"?: "Human Name",
    "elements": [CompactElement], "flows": [CompactFlow] }

CompactElement — all fields except id+type are optional
  {
    "id":             unique element ID,
    "type":           BpmnElementType (see below),
    "name":           display label,

    serviceTask/sendTask:
    "jobType":        Zeebe job type string (e.g. "my-worker"),
    "taskHeaders":    { key: value } — Zeebe task headers,
    "resultVariable": variable to store the response in,

    callActivity:
    "calledProcess":  process ID of the called process,

    userTask:
    "formId":         Camunda form ID,

    businessRuleTask:
    "decisionId":     DMN decision ID,
    "resultVariable": variable to store decision result,

    events (startEvent, endEvent, boundaryEvent, intermediateCatchEvent, etc.):
    "eventType":      timer | message | signal | error | escalation
                      | terminate | cancel | conditional | link | compensate,

    boundaryEvent:
    "attachedTo":     ID of the host task,
    "interrupting":   false for non-interrupting (default: true),

    subProcess/eventSubProcess/transaction:
    "children":       { "elements": [...], "flows": [...] }
  }

CompactFlow
  {
    "id":        unique flow ID,
    "from":      source element ID,
    "to":        target element ID,
    "name"?:     flow label,
    "condition"?: FEEL condition expression (e.g. "= status = \\"approved\\"")
  }

ELEMENT TYPES
  Tasks:    serviceTask  userTask  scriptTask  businessRuleTask
            callActivity  sendTask  receiveTask  manualTask  task
  Events:   startEvent  endEvent  intermediateCatchEvent  intermediateThrowEvent
            boundaryEvent
  Gateways: exclusiveGateway  parallelGateway  inclusiveGateway
            eventBasedGateway  complexGateway
  Containers: subProcess  adHocSubProcess  eventSubProcess  transaction

HTTP CONNECTOR (serviceTask)
  { "type": "serviceTask", "jobType": "io.camunda:http-json:1",
    "taskHeaders": { "url": "https://...", "method": "POST" },
    "resultVariable": "response" }

PATCH FORMAT (for --patch and stdin when --input is set)
  Adds elements and flows to an existing process. IDs must not collide.
  {
    "elements": [CompactElement, ...],  // new elements to add
    "flows":    [CompactFlow, ...]      // new flows to add (can reference existing IDs)
  }

  Example — add a rejection path to an existing gateway named "gw":
  {
    "elements": [
      { "id": "rejected",  "type": "serviceTask", "name": "Notify Rejection", "jobType": "notify" },
      { "id": "end-reject","type": "endEvent",     "name": "Rejected" }
    ],
    "flows": [
      { "id": "f-rej1", "from": "gw",       "to": "rejected",  "condition": "= not approved", "name": "No" },
      { "id": "f-rej2", "from": "rejected",  "to": "end-reject" }
    ]
  }

FULL EXAMPLE — order approval
  {
    "id": "Definitions_order",
    "processes": [{
      "id": "order-approval",
      "name": "Order Approval",
      "elements": [
        { "id": "start",     "type": "startEvent",      "name": "Order Received" },
        { "id": "validate",  "type": "serviceTask",     "name": "Validate",      "jobType": "validate-order" },
        { "id": "gw",        "type": "exclusiveGateway","name": "Valid?" },
        { "id": "review",    "type": "userTask",        "name": "Manual Review", "formId": "review-form" },
        { "id": "process",   "type": "serviceTask",     "name": "Process Order", "jobType": "process-order" },
        { "id": "end-ok",    "type": "endEvent",        "name": "Processed" },
        { "id": "end-rej",   "type": "endEvent",        "name": "Rejected" },
        { "id": "err",       "type": "boundaryEvent",   "attachedTo": "validate", "eventType": "error" },
        { "id": "end-err",   "type": "endEvent",        "name": "Validation Error", "eventType": "error" }
      ],
      "flows": [
        { "id": "f1", "from": "start",    "to": "validate" },
        { "id": "f2", "from": "validate", "to": "gw" },
        { "id": "f3", "from": "gw",       "to": "review",  "condition": "= not valid", "name": "Invalid" },
        { "id": "f4", "from": "gw",       "to": "process", "condition": "= valid",     "name": "Valid" },
        { "id": "f5", "from": "review",   "to": "end-rej", "name": "Rejected" },
        { "id": "f6", "from": "review",   "to": "process", "name": "Approved" },
        { "id": "f7", "from": "process",  "to": "end-ok" },
        { "id": "f8", "from": "err",      "to": "end-err" }
      ]
    }]
  }`

// ── Templates ─────────────────────────────────────────────────────────────────

type TemplateFn = (id: string, name?: string) => CompactDiagram

const TEMPLATES: Record<string, TemplateFn> = {
	empty: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "New Process",
				elements: [{ id: "start", type: "startEvent", name: "Start" }],
				flows: [],
			},
		],
	}),

	minimal: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "New Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{
						id: "task1",
						type: "serviceTask",
						name: name ? `${name} Task` : "Process Request",
						jobType: "my-worker",
					},
					{ id: "end", type: "endEvent", name: "End" },
				],
				flows: [
					{ id: "f1", from: "start", to: "task1" },
					{ id: "f2", from: "task1", to: "end" },
				],
			},
		],
	}),

	"user-task": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Human Task Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{ id: "ut1", type: "userTask", name: name ?? "Review", formId: "my-form" },
					{ id: "end", type: "endEvent", name: "Done" },
				],
				flows: [
					{ id: "f1", from: "start", to: "ut1" },
					{ id: "f2", from: "ut1", to: "end" },
				],
			},
		],
	}),

	"call-activity": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Orchestration Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{
						id: "ca1",
						type: "callActivity",
						name: name ?? "Run Sub-Process",
						calledProcess: "child-process",
					},
					{ id: "end", type: "endEvent", name: "Done" },
				],
				flows: [
					{ id: "f1", from: "start", to: "ca1" },
					{ id: "f2", from: "ca1", to: "end" },
				],
			},
		],
	}),

	"business-rule": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Decision Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{
						id: "brt1",
						type: "businessRuleTask",
						name: name ?? "Evaluate Decision",
						decisionId: "my-decision",
						resultVariable: "decisionResult",
					},
					{ id: "end", type: "endEvent", name: "Done" },
				],
				flows: [
					{ id: "f1", from: "start", to: "brt1" },
					{ id: "f2", from: "brt1", to: "end" },
				],
			},
		],
	}),

	approval: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Approval Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Request Received" },
					{ id: "review", type: "userTask", name: "Review Request", formId: "review-form" },
					{ id: "gw", type: "exclusiveGateway", name: "Approved?" },
					{
						id: "process",
						type: "serviceTask",
						name: "Process Approval",
						jobType: "process-approval",
					},
					{ id: "end-ok", type: "endEvent", name: "Approved" },
					{ id: "end-rej", type: "endEvent", name: "Rejected" },
				],
				flows: [
					{ id: "f1", from: "start", to: "review" },
					{ id: "f2", from: "review", to: "gw" },
					{ id: "f3", from: "gw", to: "process", condition: "= approved", name: "Yes" },
					{ id: "f4", from: "gw", to: "end-rej", condition: "= not approved", name: "No" },
					{ id: "f5", from: "process", to: "end-ok" },
				],
			},
		],
	}),

	parallel: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Parallel Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{ id: "fork", type: "parallelGateway", name: "Fork" },
					{ id: "task1", type: "serviceTask", name: "Task A", jobType: "task-a" },
					{ id: "task2", type: "serviceTask", name: "Task B", jobType: "task-b" },
					{ id: "join", type: "parallelGateway", name: "Join" },
					{ id: "end", type: "endEvent", name: "End" },
				],
				flows: [
					{ id: "f1", from: "start", to: "fork" },
					{ id: "f2", from: "fork", to: "task1" },
					{ id: "f3", from: "fork", to: "task2" },
					{ id: "f4", from: "task1", to: "join" },
					{ id: "f5", from: "task2", to: "join" },
					{ id: "f6", from: "join", to: "end" },
				],
			},
		],
	}),

	inclusive: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Inclusive Gateway Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{ id: "split", type: "inclusiveGateway", name: "Which?" },
					{ id: "task1", type: "serviceTask", name: "Option A", jobType: "option-a" },
					{ id: "task2", type: "serviceTask", name: "Option B", jobType: "option-b" },
					{ id: "merge", type: "inclusiveGateway", name: "Merge" },
					{ id: "end", type: "endEvent", name: "End" },
				],
				flows: [
					{ id: "f1", from: "start", to: "split" },
					{ id: "f2", from: "split", to: "task1", condition: "= needsA", name: "A" },
					{ id: "f3", from: "split", to: "task2", condition: "= needsB", name: "B" },
					{ id: "f4", from: "task1", to: "merge" },
					{ id: "f5", from: "task2", to: "merge" },
					{ id: "f6", from: "merge", to: "end" },
				],
			},
		],
	}),

	"timer-start": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Scheduled Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Timer", eventType: "timer" },
					{
						id: "task1",
						type: "serviceTask",
						name: name ?? "Scheduled Job",
						jobType: "scheduled-worker",
					},
					{ id: "end", type: "endEvent", name: "Done" },
				],
				flows: [
					{ id: "f1", from: "start", to: "task1" },
					{ id: "f2", from: "task1", to: "end" },
				],
			},
		],
	}),

	"message-start": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Message-Triggered Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Message Received", eventType: "message" },
					{
						id: "task1",
						type: "serviceTask",
						name: name ?? "Handle Message",
						jobType: "message-handler",
					},
					{ id: "end", type: "endEvent", name: "Done" },
				],
				flows: [
					{ id: "f1", from: "start", to: "task1" },
					{ id: "f2", from: "task1", to: "end" },
				],
			},
		],
	}),

	"error-boundary": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Error Handling Process",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{ id: "task1", type: "serviceTask", name: name ?? "Risky Task", jobType: "risky-worker" },
					{
						id: "err",
						type: "boundaryEvent",
						attachedTo: "task1",
						eventType: "error",
						name: "Error",
					},
					{ id: "end-ok", type: "endEvent", name: "Success" },
					{ id: "end-err", type: "endEvent", name: "Failed", eventType: "error" },
				],
				flows: [
					{ id: "f1", from: "start", to: "task1" },
					{ id: "f2", from: "task1", to: "end-ok" },
					{ id: "f3", from: "err", to: "end-err" },
				],
			},
		],
	}),

	subprocess: (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Sub-Process Demo",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{
						id: "sp1",
						type: "subProcess",
						name: name ?? "Sub-Process",
						children: {
							elements: [
								{ id: "sp_start", type: "startEvent", name: "Begin" },
								{ id: "sp_task", type: "serviceTask", name: "Inner Task", jobType: "inner-worker" },
								{ id: "sp_end", type: "endEvent", name: "Finish" },
							],
							flows: [
								{ id: "sf1", from: "sp_start", to: "sp_task" },
								{ id: "sf2", from: "sp_task", to: "sp_end" },
							],
						},
					},
					{ id: "end", type: "endEvent", name: "End" },
				],
				flows: [
					{ id: "f1", from: "start", to: "sp1" },
					{ id: "f2", from: "sp1", to: "end" },
				],
			},
		],
	}),

	"event-subprocess": (id, name) => ({
		id: `Definitions_${id}`,
		processes: [
			{
				id,
				name: name ?? "Process with Error Handler",
				elements: [
					{ id: "start", type: "startEvent", name: "Start" },
					{ id: "task1", type: "serviceTask", name: name ?? "Main Task", jobType: "main-worker" },
					{ id: "end", type: "endEvent", name: "End" },
					{
						id: "evtsp",
						type: "eventSubProcess",
						name: "Error Handler",
						children: {
							elements: [
								{
									id: "evtsp_start",
									type: "startEvent",
									name: "Error",
									eventType: "error",
									interrupting: false,
								},
								{
									id: "evtsp_task",
									type: "serviceTask",
									name: "Compensate",
									jobType: "compensate-worker",
								},
								{ id: "evtsp_end", type: "endEvent", name: "Handled" },
							],
							flows: [
								{ id: "sf1", from: "evtsp_start", to: "evtsp_task" },
								{ id: "sf2", from: "evtsp_task", to: "evtsp_end" },
							],
						},
					},
				],
				flows: [
					{ id: "f1", from: "start", to: "task1" },
					{ id: "f2", from: "task1", to: "end" },
				],
			},
		],
	}),
}

const TEMPLATE_NAMES = Object.keys(TEMPLATES).sort()

// ── Patch type ────────────────────────────────────────────────────────────────

interface CompactPatch {
	elements?: CompactElement[]
	flows?: CompactFlow[]
}

// ── Stdin reader ──────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
	}
	return Buffer.concat(chunks).toString("utf-8").trim()
}

// ── Output path guard ─────────────────────────────────────────────────────────

/**
 * Decide where `--input` mode writes, refusing to replace the input file unless
 * the caller asked for it explicitly.
 *
 * Modifying an existing file round-trips it through {@link compactify} and
 * {@link expand}, which model only a subset of BPMN. Collaborations, pools,
 * lanes, data stores, artifacts, root-level messages and errors, and Zeebe
 * details such as `zeebe:subscription` correlation keys and `zeebe:ioMapping`
 * entries do not survive. Writing that result back over the source destroys the
 * original, so in-place replacement has to be asked for by name.
 *
 * @param inputFile - The `--input` path.
 * @param outputFlag - The `--output` path, if any. `-` (stdout) is handled by the caller.
 * @param force - Whether `--force` was passed.
 * @returns The path to write to.
 * @throws If the write would replace `inputFile` and `force` is false.
 */
export function resolveModifyOutputPath({
	inputFile,
	outputFlag,
	force,
}: {
	inputFile: string
	outputFlag: string | undefined
	force: boolean
}): string {
	const output = typeof outputFlag === "string" && outputFlag.length > 0 ? outputFlag : undefined
	const inPlace = output === undefined || resolve(output) === resolve(inputFile)

	if (inPlace && !force) {
		throw new Error(
			[
				`Refusing to overwrite ${inputFile}.`,
				"Modifying a file re-serialises it from a compact model that does not carry " +
					"collaborations, pools, lanes, data stores, artifacts, root messages/errors, or " +
					"Zeebe subscription and ioMapping detail — writing the result back would drop them.",
				`Write elsewhere with --output <file>, or pass --force to replace ${inputFile} anyway.`,
			].join("\n"),
		)
	}

	return output ?? inputFile
}

// ── Command ───────────────────────────────────────────────────────────────────

const generateBpmnCmd: Command = {
	name: "bpmn",
	description:
		"Generate a BPMN file from parameters, a template, or a CompactDiagram JSON definition",
	args: [],
	flags: [
		{
			name: "process-id",
			short: "i",
			description: "Process ID (used in templates)",
			type: "string",
		},
		{
			name: "name",
			short: "n",
			description: "Process display name (used in templates)",
			type: "string",
		},
		{
			name: "output",
			short: "o",
			description: "Output file path. Default: <process-id>.bpmn. Use - for stdout.",
			type: "string",
		},
		{
			name: "template",
			description: `Template name. Options: ${TEMPLATE_NAMES.join(", ")}`,
			type: "string",
			default: "minimal",
			enum: TEMPLATE_NAMES,
		},
		{
			name: "definition",
			short: "d",
			description: "CompactDiagram JSON string (overrides --template). See --help-schema.",
			type: "string",
		},
		{
			name: "help-schema",
			description: "Print the CompactDiagram JSON schema and exit",
			type: "boolean",
		},
		{
			name: "input",
			short: "f",
			description:
				"Existing .bpmn file to load and modify. Lossy — the file is rebuilt from a compact " +
				"model that drops collaborations, pools, lanes, data stores, artifacts, root " +
				"messages/errors, and Zeebe subscription/ioMapping detail. Requires --output, or " +
				"--force to replace it in place.",
			type: "string",
		},
		{
			name: "patch",
			description:
				'JSON patch to apply to --input: {"elements":[...],"flows":[...]}. See --help-schema.',
			type: "string",
		},
		{
			name: "dump-compact",
			description:
				"Print the CompactDiagram JSON of --input and exit (for AI inspection of existing files)",
			type: "boolean",
		},
		{
			name: "force",
			description:
				"Allow --input to be replaced in place. Lossy: see --input. Prefer --output <file>.",
			type: "boolean",
		},
	],
	examples: [
		{
			description: "Minimal service-task process",
			command: "casen generate bpmn --process-id order --name 'Order Processing'",
		},
		{
			description: "Approval workflow template",
			command: "casen generate bpmn --template approval --process-id approve",
		},
		{
			description: "Timer-triggered scheduled job",
			command: "casen generate bpmn --template timer-start --process-id nightly-sync",
		},
		{
			description: "Parallel branch pattern",
			command: "casen generate bpmn --template parallel --process-id enrich --name Enrichment",
		},
		{
			description: "Error boundary with error end event",
			command: "casen generate bpmn --template error-boundary --process-id resilient",
		},
		{
			description: "Full custom definition (AI/scripting path)",
			command:
				'casen generate bpmn --definition \'{"id":"Defs","processes":[{"id":"p","elements":[...],"flows":[...]}]}\'',
		},
		{
			description: "Pipe CompactDiagram JSON from AI output",
			command: "echo '{...}' | casen generate bpmn --output my-process.bpmn",
		},
		{
			description: "Print full JSON schema reference",
			command: "casen generate bpmn --help-schema",
		},
		{
			description: "Inspect an existing file as compact JSON (AI planning step)",
			command: "casen generate bpmn --input existing.bpmn --dump-compact",
		},
		{
			description: "Add a new gateway path to an existing file",
			command:
				'casen generate bpmn --input order.bpmn --output order.patched.bpmn --patch \'{"elements":[{"id":"notify","type":"serviceTask","name":"Notify","jobType":"notify-worker"},{"id":"end2","type":"endEvent","name":"Notified"}],"flows":[{"id":"fn1","from":"gw","to":"notify","condition":"= urgent"},{"id":"fn2","from":"notify","to":"end2"}]}\'',
		},
		{
			description: "Pipe a patch from AI output",
			command:
				'echo \'{"elements":[...],"flows":[...]}\' | casen generate bpmn --input order.bpmn --output order.patched.bpmn',
		},
		{
			description: "Re-apply auto-layout to an existing file",
			command: "casen generate bpmn --input messy.bpmn --output clean.bpmn",
		},
	],
	async run(ctx) {
		// --help-schema: print schema and exit
		if (ctx.flags["help-schema"]) {
			process.stdout.write(`${SCHEMA_HELP}\n`)
			return
		}

		const processId = (ctx.flags["process-id"] as string | undefined)?.trim() || "process"
		const name = (ctx.flags.name as string | undefined)?.trim()
		const outputFlag = ctx.flags.output as string | undefined
		const defFlag = ctx.flags.definition as string | undefined
		const inputFile = ctx.flags.input as string | undefined
		const patchFlag = ctx.flags.patch as string | undefined

		// ── Modify-existing mode (--input) ─────────────────────────────────────
		if (inputFile) {
			const xml = await readFile(inputFile, "utf-8")
			const defs = Bpmn.parse(xml)
			const compact = compactify(defs)

			// --dump-compact: print JSON for AI inspection and exit
			if (ctx.flags["dump-compact"]) {
				process.stdout.write(`${JSON.stringify(compact, null, 2)}\n`)
				return
			}

			// Settle the destination before reading stdin or building the patch, so an
			// unwritable target fails immediately instead of after the work is done.
			const outputPath =
				outputFlag === "-"
					? null
					: resolveModifyOutputPath({
							inputFile,
							outputFlag,
							force: ctx.flags.force === true,
						})

			// Resolve patch from --patch flag or stdin
			let patch: CompactPatch | null = null
			if (patchFlag) {
				try {
					patch = JSON.parse(patchFlag) as CompactPatch
				} catch {
					throw new Error("--patch is not valid JSON. Run --help-schema to see the format.")
				}
			} else if (!process.stdin.isTTY) {
				const raw = await readStdin()
				if (raw) {
					try {
						patch = JSON.parse(raw) as CompactPatch
					} catch {
						throw new Error(
							"stdin is not valid patch JSON. Expected {elements:[...],flows:[...]}. Run --help-schema.",
						)
					}
				}
			}

			// Apply patch to first process (covers all single-process cases)
			if (patch) {
				const proc = compact.processes[0]
				if (!proc) throw new Error("Input BPMN has no processes")
				if (patch.elements?.length) proc.elements.push(...patch.elements)
				if (patch.flows?.length) proc.flows.push(...patch.flows)
			}

			const patched = Bpmn.export(expand(compact))

			if (outputPath === null) {
				process.stdout.write(patched)
				return
			}

			await writeFile(outputPath, patched, "utf-8")
			ctx.output.ok(
				patch ? `Patched and written to ${outputPath}` : `Re-laid-out and written to ${outputPath}`,
			)
			return
		}

		// ── Generate mode (template / definition / stdin) ──────────────────────
		let compact: CompactDiagram | null = null

		if (defFlag) {
			try {
				compact = JSON.parse(defFlag) as CompactDiagram
			} catch {
				throw new Error("--definition is not valid JSON. Run --help-schema to see the format.")
			}
		} else if (!process.stdin.isTTY) {
			const raw = await readStdin()
			if (raw) {
				try {
					compact = JSON.parse(raw) as CompactDiagram
				} catch {
					throw new Error(
						"stdin is not valid CompactDiagram JSON. Run --help-schema to see the format.",
					)
				}
			}
		}

		let xml: string

		if (compact) {
			xml = Bpmn.export(expand(compact))
		} else {
			const templateName = (ctx.flags.template as string | undefined) ?? "minimal"
			const templateFn = TEMPLATES[templateName]
			if (!templateFn) {
				throw new Error(
					`Unknown template "${templateName}". Available: ${TEMPLATE_NAMES.join(", ")}`,
				)
			}
			xml = Bpmn.export(expand(templateFn(processId, name)))
		}

		if (outputFlag === "-") {
			process.stdout.write(xml)
			return
		}

		const effectiveId =
			compact?.processes[0]?.id ?? (ctx.flags["process-id"] as string | undefined) ?? "process"
		const outputPath =
			typeof outputFlag === "string" && outputFlag.length > 0 ? outputFlag : `${effectiveId}.bpmn`

		await writeFile(outputPath, xml, "utf-8")
		ctx.output.ok(`BPMN written to ${outputPath}`)
	},
}

export const generateGroup: CommandGroup = {
	name: "generate",
	aliases: ["gen"],
	description: "Generate BPMN, DMN, and form files from parameters",
	commands: [generateBpmnCmd],
}
