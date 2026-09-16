#!/usr/bin/env node
/**
 * Extracts the FEEL test cases of the DMN TCK into JSON that
 * `tests/tck.test.ts` can run.
 *
 *   node tasks/extract-tck-tests.mjs --tck ../dmn-tck
 *
 * The TCK is not a dependency of this repo: clone https://github.com/dmn-tck/tck
 * next to it, or point --tck (or TCK_DIR) at a checkout.
 *
 * Each TCK case is a pair of files: a model holding the FEEL expression of
 * every decision, and a test file holding the inputs and the expected result
 * per decision. Both are rewritten here into one JSON file per test, where an
 * input and an expected result are themselves FEEL expressions, so the runner
 * only has to evaluate and compare.
 */

import fs from "node:fs"
import path from "node:path"

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }

function decodeEntities(text) {
	if (!text.includes("&")) return text
	return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
		if (body[0] === "#") {
			const code =
				body[1] === "x" || body[1] === "X"
					? Number.parseInt(body.slice(2), 16)
					: Number.parseInt(body.slice(1), 10)
			return Number.isNaN(code) ? match : String.fromCodePoint(code)
		}
		return ENTITIES[body] ?? match
	})
}

function parseAttributes(source) {
	const attrs = {}
	const re = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g
	let m = re.exec(source)
	while (m) {
		attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? "")
		m = re.exec(source)
	}
	return attrs
}

/**
 * Walks an XML document, calling the handlers with namespace-resolved element
 * names. Enough of XML for the TCK's generated files: elements, attributes,
 * text, CDATA, comments and the prolog.
 */
function parseXml(xml, handlers) {
	// Namespace bindings, innermost last. A name resolves against the prefix
	// declared nearest to it.
	const scopes = [{}]
	const open = []

	const resolve = (qname) => {
		const colon = qname.indexOf(":")
		const prefix = colon < 0 ? "" : qname.slice(0, colon)
		const local = colon < 0 ? qname : qname.slice(colon + 1)
		for (let i = scopes.length - 1; i >= 0; i--) {
			const uri = scopes[i][prefix]
			if (uri !== undefined) return { uri, local, qname }
		}
		return { uri: "", local, qname }
	}

	let i = 0
	while (i < xml.length) {
		const lt = xml.indexOf("<", i)
		if (lt < 0) break
		if (lt > i) {
			const text = xml.slice(i, lt)
			if (open.length > 0) handlers.text?.(decodeEntities(text), open[open.length - 1])
		}
		if (xml.startsWith("<!--", lt)) {
			i = xml.indexOf("-->", lt) + 3
			continue
		}
		if (xml.startsWith("<![CDATA[", lt)) {
			const end = xml.indexOf("]]>", lt)
			if (open.length > 0) handlers.text?.(xml.slice(lt + 9, end), open[open.length - 1])
			i = end + 3
			continue
		}
		if (xml.startsWith("<?", lt) || xml.startsWith("<!", lt)) {
			i = xml.indexOf(">", lt) + 1
			continue
		}
		const gt = findTagEnd(xml, lt)
		const raw = xml.slice(lt + 1, gt)
		if (raw[0] === "/") {
			const el = open.pop()
			scopes.pop()
			if (el) handlers.closeTag?.(el)
			i = gt + 1
			continue
		}
		const selfClosing = raw.endsWith("/")
		const body = selfClosing ? raw.slice(0, -1) : raw
		const space = body.search(/\s/)
		const qname = space < 0 ? body : body.slice(0, space)
		const attrs = space < 0 ? {} : parseAttributes(body.slice(space))

		const bindings = {}
		for (const [key, value] of Object.entries(attrs)) {
			if (key === "xmlns") bindings[""] = value
			else if (key.startsWith("xmlns:")) bindings[key.slice(6)] = value
		}
		scopes.push(bindings)
		const el = { ...resolve(qname), attrs }
		handlers.openTag?.(el, selfClosing)
		if (selfClosing) {
			scopes.pop()
			handlers.closeTag?.(el)
		} else {
			open.push(el)
		}
		i = gt + 1
	}
}

/** Finds the ">" closing a tag, skipping any inside a quoted attribute value. */
function findTagEnd(xml, start) {
	let quote = null
	for (let i = start + 1; i < xml.length; i++) {
		const c = xml[i]
		if (quote) {
			if (c === quote) quote = null
			continue
		}
		if (c === '"' || c === "'") quote = c
		else if (c === ">") return i
	}
	return xml.length
}

const TESTCASE_NS = "http://www.omg.org/spec/DMN/20160719/testcase"

/** True for any of the DMN model namespaces the TCK's files use (1.1 through 1.5). */
function isModelNs(uri) {
	return /spec\/DMN\/\d+\/MODEL\/?$/.test(uri) || uri.endsWith("/dmn.xsd")
}

// ---------------------------------------------------------------------------
// Model file: the FEEL expression behind each decision
// ---------------------------------------------------------------------------

function parseModelFile(file) {
	const decisions = []
	const stack = []
	const current = () => stack[stack.length - 1]
	let capture = null

	parseXml(fs.readFileSync(file, "utf8"), {
		openTag(el) {
			if (!isModelNs(el.uri)) return
			switch (el.local) {
				case "decision":
					stack.push({
						kind: "decision",
						name: el.attrs.name,
						text: "",
						description: "",
						listDepth: 0,
					})
					break
				case "contextEntry":
					stack.push({ kind: "contextEntry", name: "", text: "", listDepth: 0 })
					break
				case "variable":
					if (current()?.kind === "contextEntry") current().name = el.attrs.name
					break
				case "context":
					if (current()) current().text += "{ "
					break
				case "list":
					if (current()) {
						current().text += "[ "
						current().listDepth = (current().listDepth ?? 0) + 1
					}
					break
				case "literalExpression":
					// A list's items are separated where they begin, since each
					// item is itself an expression that may contain more text.
					if (current()?.listDepth > 0 && !current().text.endsWith("[ ")) {
						current().text += ", "
					}
					break
				case "text":
					if (current()) capture = "text"
					break
				case "description":
					if (current()?.kind === "decision") capture = "description"
					break
				default:
					break
			}
		},
		text(value) {
			if (capture && current()) current()[capture] += value
		},
		closeTag(el) {
			if (!isModelNs(el.uri)) return
			switch (el.local) {
				case "text":
				case "description":
					capture = null
					break
				case "context":
					if (current()) current().text += " }"
					break
				case "list":
					if (current()) {
						current().text += " ]"
						current().listDepth -= 1
					}
					break
				case "contextEntry": {
					const entry = stack.pop()
					const parent = current()
					if (!parent) break
					if (!parent.text.endsWith("{ ")) parent.text += ", "
					parent.text += `${entry.name || '""'}: ${entry.text}`
					break
				}
				case "decision": {
					const decision = stack.pop()
					if (decision) decisions.push(decision)
					break
				}
				default:
					break
			}
		},
	})

	return decisions
}

// ---------------------------------------------------------------------------
// Test file: inputs and expected results, rendered back into FEEL
// ---------------------------------------------------------------------------

/** Renders one <inputNode>/<expected> subtree as the FEEL expression it denotes. */
function createValueReader() {
	const tokens = []
	// One frame per open element that contributes a delimiter, so that closing
	// the element can emit its closer.
	const frames = []
	let depth = 0

	const openFrame = (type, closer, opener) => {
		frames.push({ type, closer, depth })
		if (opener !== undefined) tokens.push(opener)
	}
	const typeOf = () => frames[frames.length - 1]?.type

	return {
		open(el) {
			if (el.local === "component") {
				if (typeOf() === "context") tokens.push(", ")
				else openFrame("context", "}", "{")
			}
			depth++
			if (el.local === "item") {
				if (typeOf() === "list" && frames[frames.length - 1].items > 0) tokens.push(", ")
				if (typeOf() === "list") frames[frames.length - 1].items++
				return
			}
			if (el.attrs["xsi:nil"] === "true") {
				tokens.push("null")
				return
			}
			if (el.local === "list") {
				const frame = { type: "list", closer: "]", depth, items: 0 }
				frames.push(frame)
				tokens.push("[")
				return
			}
			if (el.local === "value") {
				const type = el.attrs["xsi:type"] ?? ""
				if (type.endsWith(":string")) return openFrame("string", '"', '"')
				if (type.endsWith(":dateTime")) return openFrame("literal", '")', 'date and time("')
				if (type.endsWith(":date")) return openFrame("literal", '")', 'date("')
				if (type.endsWith(":time")) return openFrame("literal", '")', 'time("')
				if (type.endsWith(":duration")) return openFrame("literal", '")', 'duration("')
				return openFrame("raw")
			}
			if (el.local === "component") {
				openFrame("entry")
				tokens.push(`"${el.attrs.name}": `)
			}
		},
		text(value) {
			if (typeOf() !== "string" && !value.trim()) return
			tokens.push(typeOf() === "string" ? value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : value)
		},
		close() {
			depth--
			while (frames.length > 0 && frames[frames.length - 1].depth > depth) {
				const frame = frames.pop()
				if (frame.closer) tokens.push(frame.closer)
			}
		},
		result() {
			while (frames.length > 0) {
				const frame = frames.pop()
				if (frame.closer) tokens.push(frame.closer)
			}
			return tokens.join("").trim()
		},
	}
}

function parseTestFile(file) {
	const test = { testName: path.basename(file), modelName: null, cases: [] }
	let testCase = null
	let node = null
	let reader = null
	let inModelName = false
	let inDescription = false

	parseXml(fs.readFileSync(file, "utf8"), {
		openTag(el) {
			if (el.uri !== TESTCASE_NS) return
			if (el.local === "modelName") {
				inModelName = true
				return
			}
			if (el.local === "testCase") {
				testCase = { id: el.attrs.id, description: "", inputNodes: [], resultNodes: [] }
				test.cases.push(testCase)
				return
			}
			if (el.local === "description" && testCase && !reader) {
				inDescription = true
				return
			}
			if (el.local === "inputNode") {
				node = { name: el.attrs.name }
				testCase?.inputNodes.push(node)
				reader = createValueReader()
				return
			}
			if (el.local === "resultNode") {
				node = { name: el.attrs.name, type: el.attrs.type }
				testCase?.resultNodes.push(node)
				return
			}
			if (el.local === "expected") {
				reader = createValueReader()
				return
			}
			reader?.open(el)
		},
		text(value, parent) {
			if (parent?.uri !== TESTCASE_NS) return
			if (inModelName) test.modelName = value.trim()
			else if (inDescription && testCase) testCase.description += value
			else reader?.text(value)
		},
		closeTag(el) {
			if (el.uri !== TESTCASE_NS) return
			if (el.local === "modelName") {
				inModelName = false
				return
			}
			if (el.local === "description") {
				inDescription = false
				return
			}
			if (el.local === "expected" || el.local === "inputNode") {
				if (node && reader) node.value = reader.result()
				reader = null
				return
			}
			reader?.close()
		},
	})

	return test
}

// ---------------------------------------------------------------------------
// Merge and write
// ---------------------------------------------------------------------------

function toRuns(test, decisions) {
	const runs = []
	for (const testCase of test.cases) {
		const context = testCase.inputNodes.map(({ name, value }) => `"${name}": ${value}`).join(", ")
		for (const resultNode of testCase.resultNodes) {
			const decision = decisions.find((d) => d.name === resultNode.name)
			if (!decision?.text.trim()) continue
			runs.push({
				id: `${testCase.id}/${resultNode.name}`,
				description: testCase.description.trim() || decision.description.trim(),
				context: context ? `{ ${context} }` : null,
				expression: decision.text.trim(),
				expected: resultNode.value ?? "null",
			})
		}
	}
	return runs
}

function findTestFiles(testCasesDir) {
	const files = []
	for (const level of readDirs(testCasesDir)) {
		for (const testDir of readDirs(path.join(testCasesDir, level))) {
			if (!/-feel-/.test(testDir)) continue
			const dir = path.join(testCasesDir, level, testDir)
			for (const entry of fs.readdirSync(dir)) {
				if (entry.endsWith(".xml")) files.push(path.join(dir, entry))
			}
		}
	}
	return files.sort()
}

function readDirs(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort()
}

function parseArgs(argv) {
	const args = { tck: process.env.TCK_DIR ?? "../dmn-tck", out: "tests/tck", filter: null }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === "--tck" || arg === "--out" || arg === "--filter") {
			const value = argv[++i]
			if (value === undefined) throw new Error(`${arg} needs a value`)
			args[arg.slice(2)] = value
		} else if (arg === "--help" || arg === "-h") {
			args.help = true
		} else {
			throw new Error(`unknown argument: ${arg}`)
		}
	}
	return args
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	if (args.help) {
		console.log(
			"usage: extract-tck-tests.mjs [--tck <dmn-tck checkout>] [--out <dir>] [--filter <substring>]",
		)
		return
	}

	const testCasesDir = path.resolve(args.tck, "TestCases")
	if (!fs.existsSync(testCasesDir)) {
		throw new Error(
			`no DMN TCK in ${path.resolve(args.tck)}. Clone https://github.com/dmn-tck/tck and pass --tck <path>, or set TCK_DIR.`,
		)
	}

	const outDir = path.resolve(args.out)
	fs.rmSync(outDir, { recursive: true, force: true })
	fs.mkdirSync(outDir, { recursive: true })

	let written = 0
	let runs = 0
	for (const testPath of findTestFiles(testCasesDir)) {
		if (args.filter && !testPath.includes(args.filter)) continue
		const test = parseTestFile(testPath)
		if (!test.modelName) continue
		const modelPath = path.join(path.dirname(testPath), test.modelName)
		if (!fs.existsSync(modelPath)) {
			console.warn(`skipping ${test.testName}: no model ${test.modelName}`)
			continue
		}
		const cases = toRuns(test, parseModelFile(modelPath))
		if (cases.length === 0) continue
		const name = path.basename(path.dirname(testPath))
		const suite = { name, testName: test.testName, cases }
		fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(suite, null, 2)}\n`)
		written++
		runs += cases.length
	}

	console.log(
		`extracted ${runs} cases from ${written} TCK tests into ${path.relative(".", outDir)}`,
	)
}

main()
