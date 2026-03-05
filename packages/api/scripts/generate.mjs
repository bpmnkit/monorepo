#!/usr/bin/env node
/**
 * Camunda API SDK Generator
 *
 * Downloads OpenAPI YAML files from the Camunda repository, resolves all
 * $ref cross-references, and generates:
 *   - src/generated/types.ts   (TypeScript interfaces for all API schemas)
 *   - src/generated/resources.ts (typed resource classes + CamundaClient)
 *
 * No external dependencies — pure Node.js ESM.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SWAGGER_DIR = join(ROOT, "swagger");
const GENERATED_DIR = join(ROOT, "src", "generated");

const BASE_URL =
	"https://raw.githubusercontent.com/camunda/camunda/refs/heads/main/zeebe/gateway-protocol/src/main/proto/v2/";

const ENTRY_FILE = "rest-api.yaml";

// ─── YAML PARSER ──────────────────────────────────────────────────────────────

/**
 * Parses a YAML string into a JavaScript value.
 * Handles the full subset used by OpenAPI 3.x specs.
 */
function parseYaml(text) {
	const parser = new YamlParser(text);
	return parser.parse();
}

class YamlParser {
	constructor(text) {
		// Normalize line endings, expand tabs
		this.lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		this.pos = 0;
		this.anchors = {};
	}

	parse() {
		// Skip document start
		while (this.pos < this.lines.length) {
			const trimmed = (this.lines[this.pos] ?? "").trim();
			if (trimmed === "---" || trimmed === "") {
				this.pos++;
			} else {
				break;
			}
		}
		return this.parseValue(0);
	}

	/** Returns the indent (leading spaces) of a line, treating tabs as 2 spaces. */
	indent(line) {
		let count = 0;
		for (const ch of line) {
			if (ch === " ") count++;
			else if (ch === "\t") count += 2;
			else break;
		}
		return count;
	}

	/** Skip blank lines and comment-only lines, return the current pos. */
	skipBlank() {
		while (this.pos < this.lines.length) {
			const line = this.lines[this.pos] ?? "";
			const trimmed = line.trim();
			if (trimmed === "" || trimmed.startsWith("#")) {
				this.pos++;
			} else {
				break;
			}
		}
	}

	currentLine() {
		return this.lines[this.pos] ?? null;
	}

	/** Strip inline comment from a value string. */
	stripComment(s) {
		// A comment starts with space + # — but be careful with quoted strings
		let inSingle = false;
		let inDouble = false;
		for (let i = 0; i < s.length; i++) {
			const ch = s[i];
			if (ch === "'" && !inDouble) inSingle = !inSingle;
			else if (ch === '"' && !inSingle) inDouble = !inDouble;
			else if (ch === "#" && !inSingle && !inDouble && i > 0 && s[i - 1] === " ") {
				return s.slice(0, i).trimEnd();
			}
		}
		return s;
	}

	/** Parse whatever value starts at the current position with the given base indent. */
	parseValue(baseIndent) {
		this.skipBlank();
		const line = this.currentLine();
		if (line === null) return null;

		const ind = this.indent(line);
		if (ind < baseIndent) return null;

		const trimmed = line.trim();

		// Anchor: &anchorName
		let anchorName = null;
		let workTrimmed = trimmed;
		const anchorMatch = workTrimmed.match(/^&(\S+)\s*(.*)/s);
		if (anchorMatch) {
			anchorName = anchorMatch[1];
			workTrimmed = anchorMatch[2] ?? "";
		}

		// Alias: *anchorName
		if (workTrimmed.startsWith("*")) {
			const alias = workTrimmed.slice(1).trim();
			this.pos++;
			const value = this.anchors[alias] ?? null;
			if (anchorName) this.anchors[anchorName] = value;
			return value;
		}

		let value;

		// Explicit block sequence at this indent
		if (workTrimmed.startsWith("- ") || workTrimmed === "-") {
			value = this.parseBlockSequence(ind);
		}
		// Explicit tag (!!str, !!int, etc.) — treat as plain value after tag
		else if (workTrimmed.startsWith("!!")) {
			const spaceIdx = workTrimmed.indexOf(" ");
			const rest = spaceIdx >= 0 ? workTrimmed.slice(spaceIdx + 1) : "";
			this.pos++;
			value = this.parseScalar(rest);
		}
		// Flow mapping
		else if (workTrimmed.startsWith("{")) {
			value = this.parseFlowMapping(workTrimmed);
			this.pos++;
		}
		// Flow sequence
		else if (workTrimmed.startsWith("[")) {
			value = this.parseFlowSequence(workTrimmed);
			this.pos++;
		}
		// Block literal scalar (|)
		else if (
			workTrimmed === "|" ||
			workTrimmed.startsWith("| ") ||
			workTrimmed.startsWith("|+") ||
			workTrimmed.startsWith("|-")
		) {
			value = this.parseBlockLiteral(ind);
		}
		// Block folded scalar (>)
		else if (
			workTrimmed === ">" ||
			workTrimmed.startsWith("> ") ||
			workTrimmed.startsWith(">+") ||
			workTrimmed.startsWith(">-")
		) {
			value = this.parseBlockFolded(ind);
		}
		// Key: value pair — mapping
		else if (this.isMapping(workTrimmed)) {
			value = this.parseBlockMapping(ind);
		}
		// Plain scalar
		else {
			this.pos++;
			value = this.parseScalar(workTrimmed);
		}

		if (anchorName !== null) {
			this.anchors[anchorName] = value;
		}
		return value;
	}

	isMapping(trimmed) {
		if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
			// Quoted key followed by colon
			const quote = trimmed[0];
			const closeIdx = trimmed.indexOf(quote, 1);
			if (closeIdx >= 0 && trimmed[closeIdx + 1] === ":") return true;
			return false;
		}
		// Check for key: — but not http://
		const colonIdx = trimmed.indexOf(":");
		if (colonIdx <= 0) return false;
		const afterColon = trimmed[colonIdx + 1];
		return (
			afterColon === " " || afterColon === "\n" || afterColon === undefined || afterColon === "\t"
		);
	}

	parseBlockMapping(baseIndent) {
		const obj = {};
		while (true) {
			this.skipBlank();
			const line = this.currentLine();
			if (line === null) break;
			const ind = this.indent(line);
			if (ind < baseIndent) break;

			const trimmed = line.trim();

			// Handle anchor on a mapping entry
			let workTrimmed = trimmed;
			const anchorMatch = workTrimmed.match(/^&(\S+)\s*(.*)/s);
			let entryAnchor = null;
			if (anchorMatch) {
				entryAnchor = anchorMatch[1];
				workTrimmed = anchorMatch[2] ?? "";
			}

			// Parse key
			let key;
			let rest;
			if (workTrimmed.startsWith('"') || workTrimmed.startsWith("'")) {
				const quote = workTrimmed[0];
				let i = 1;
				while (i < workTrimmed.length && workTrimmed[i] !== quote) {
					if (workTrimmed[i] === "\\" && quote === '"') i++;
					i++;
				}
				key = workTrimmed.slice(1, i);
				rest = workTrimmed.slice(i + 1);
				if (rest.startsWith(":")) rest = rest.slice(1);
			} else {
				const colonIdx = workTrimmed.indexOf(":");
				if (colonIdx < 0) {
					this.pos++;
					continue;
				}
				key = workTrimmed.slice(0, colonIdx).trim();
				rest = workTrimmed.slice(colonIdx + 1);
			}

			rest = rest.trimStart();

			// Strip inline comment from rest
			rest = this.stripComment(rest);

			if (entryAnchor) {
				// Will be handled below
			}

			// Value is on same line
			if (
				rest !== "" &&
				rest !== "|" &&
				rest !== ">" &&
				!rest.startsWith("|+") &&
				!rest.startsWith("|-") &&
				!rest.startsWith(">+") &&
				!rest.startsWith(">-")
			) {
				this.pos++;
				// Value might be a flow mapping/sequence or a scalar
				let val;
				if (rest.startsWith("{")) {
					val = this.parseFlowMapping(rest);
				} else if (rest.startsWith("[")) {
					val = this.parseFlowSequence(rest);
				} else if (rest.startsWith("*")) {
					val = this.anchors[rest.slice(1).trim()] ?? null;
				} else {
					val = this.parseScalar(rest);
				}
				if (entryAnchor) this.anchors[entryAnchor] = val;
				obj[key] = val;
			} else if (rest === "|" || rest.startsWith("|+") || rest.startsWith("|-")) {
				this.pos++;
				const val = this.parseBlockLiteral(ind + 1);
				if (entryAnchor) this.anchors[entryAnchor] = val;
				obj[key] = val;
			} else if (rest === ">" || rest.startsWith(">+") || rest.startsWith(">-")) {
				this.pos++;
				const val = this.parseBlockFolded(ind + 1);
				if (entryAnchor) this.anchors[entryAnchor] = val;
				obj[key] = val;
			} else {
				// Value is on subsequent lines — peek to determine type
				this.pos++;
				this.skipBlank();
				const nextLine = this.currentLine();
				if (nextLine === null) {
					obj[key] = null;
					continue;
				}
				const nextInd = this.indent(nextLine);
				const nextTrimmed = nextLine.trim();

				if (nextInd <= ind) {
					obj[key] = null;
					continue;
				}

				let val;
				if (nextTrimmed.startsWith("- ") || nextTrimmed === "-") {
					val = this.parseBlockSequence(nextInd);
				} else if (nextTrimmed.startsWith("{")) {
					val = this.parseFlowMapping(nextTrimmed);
					this.pos++;
				} else if (nextTrimmed.startsWith("[")) {
					val = this.parseFlowSequence(nextTrimmed);
					this.pos++;
				} else if (nextTrimmed.startsWith("*")) {
					val = this.anchors[nextTrimmed.slice(1).trim()] ?? null;
					this.pos++;
				} else {
					val = this.parseBlockMapping(nextInd);
				}
				if (entryAnchor) this.anchors[entryAnchor] = val;
				obj[key] = val;
			}

			if (entryAnchor && !(key in obj)) {
				// Already handled above
			}
		}
		return obj;
	}

	parseBlockSequence(baseIndent) {
		const arr = [];
		while (true) {
			this.skipBlank();
			const line = this.currentLine();
			if (line === null) break;
			const ind = this.indent(line);
			if (ind < baseIndent) break;

			const trimmed = line.trim();
			if (!trimmed.startsWith("-")) break;

			// Item content after the '-'
			const itemContent = trimmed.slice(1).trimStart();
			this.pos++;

			if (itemContent === "") {
				// Value is on the next lines
				this.skipBlank();
				const nextLine = this.currentLine();
				if (nextLine === null) {
					arr.push(null);
					continue;
				}
				const nextInd = this.indent(nextLine);
				if (nextInd <= ind) {
					arr.push(null);
					continue;
				}
				const nextTrimmed = nextLine.trim();
				let val;
				if (nextTrimmed.startsWith("- ") || nextTrimmed === "-") {
					val = this.parseBlockSequence(nextInd);
				} else if (nextTrimmed.startsWith("{")) {
					val = this.parseFlowMapping(nextTrimmed);
					this.pos++;
				} else {
					val = this.parseBlockMapping(nextInd);
				}
				arr.push(val);
			} else if (itemContent.startsWith("{")) {
				arr.push(this.parseFlowMapping(itemContent));
			} else if (itemContent.startsWith("[")) {
				arr.push(this.parseFlowSequence(itemContent));
			} else if (this.isMapping(itemContent)) {
				// Inline mapping items: parse as mapping block at ind+2
				// Put the item back but pretend it's a block mapping at current indent
				const itemIndent = ind + 2;
				// Parse as single-entry mapping first, then continue
				const obj = {};
				const colonIdx = itemContent.indexOf(":");
				const k = itemContent.slice(0, colonIdx).trim();
				const v = this.stripComment(itemContent.slice(colonIdx + 1).trimStart());
				if (v !== "") {
					if (v.startsWith("{")) obj[k] = this.parseFlowMapping(v);
					else if (v.startsWith("[")) obj[k] = this.parseFlowSequence(v);
					else obj[k] = this.parseScalar(v);
				} else {
					// More keys follow at itemIndent
					this.skipBlank();
					const nextLine2 = this.currentLine();
					if (nextLine2 !== null && this.indent(nextLine2) >= itemIndent) {
						const more = this.parseBlockMapping(itemIndent);
						Object.assign(obj, more);
					} else {
						obj[k] = null;
					}
				}
				// Merge any continuation keys
				this.skipBlank();
				const after = this.currentLine();
				if (after !== null && this.indent(after) === itemIndent) {
					const more = this.parseBlockMapping(itemIndent);
					Object.assign(obj, more);
				}
				arr.push(obj);
			} else {
				arr.push(this.parseScalar(itemContent));
			}
		}
		return arr;
	}

	parseBlockLiteral(baseIndent) {
		const lines = [];
		while (this.pos < this.lines.length) {
			const line = this.lines[this.pos] ?? "";
			const trimmed = line.trim();
			if (trimmed === "" || this.indent(line) >= baseIndent) {
				lines.push(line.slice(baseIndent));
				this.pos++;
			} else {
				break;
			}
		}
		// Remove leading/trailing blank lines
		while (lines.length > 0 && (lines[0] ?? "").trim() === "") lines.shift();
		while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") lines.pop();
		return lines.join("\n");
	}

	parseBlockFolded(baseIndent) {
		const lines = [];
		while (this.pos < this.lines.length) {
			const line = this.lines[this.pos] ?? "";
			const trimmed = line.trim();
			if (trimmed === "" || this.indent(line) >= baseIndent) {
				lines.push(line.slice(baseIndent));
				this.pos++;
			} else {
				break;
			}
		}
		while (lines.length > 0 && (lines[0] ?? "").trim() === "") lines.shift();
		while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") lines.pop();
		// Fold: join non-empty lines with spaces, blank lines become newlines
		const result = [];
		let prev = "";
		for (const line of lines) {
			if (line.trim() === "") {
				if (prev !== "") result.push(prev);
				result.push("");
				prev = "";
			} else {
				prev = prev ? `${prev} ${line.trim()}` : line.trim();
			}
		}
		if (prev) result.push(prev);
		return result.join("\n");
	}

	parseFlowMapping(text) {
		// Remove surrounding braces
		let inner = text.trim();
		if (inner.startsWith("{")) inner = inner.slice(1);
		if (inner.endsWith("}")) inner = inner.slice(0, -1);
		inner = inner.trim();
		if (!inner) return {};
		const obj = {};
		const entries = splitFlow(inner, ",");
		for (const entry of entries) {
			const colonIdx = entry.indexOf(":");
			if (colonIdx < 0) continue;
			const k = entry
				.slice(0, colonIdx)
				.trim()
				.replace(/^['"]|['"]$/g, "");
			const v = entry
				.slice(colonIdx + 1)
				.trim()
				.replace(/^['"]|['"]$/g, "");
			obj[k] = this.parseScalar(v);
		}
		return obj;
	}

	parseFlowSequence(text) {
		let inner = text.trim();
		if (inner.startsWith("[")) inner = inner.slice(1);
		if (inner.endsWith("]")) inner = inner.slice(0, -1);
		inner = inner.trim();
		if (!inner) return [];
		return splitFlow(inner, ",").map((item) => this.parseScalar(item.trim()));
	}

	parseScalar(s) {
		const str = s.trim();
		if (str === "" || str === "null" || str === "~") return null;
		if (str === "true") return true;
		if (str === "false") return false;
		if (str === ".inf" || str === "+.inf") return Number.POSITIVE_INFINITY;
		if (str === "-.inf") return Number.NEGATIVE_INFINITY;
		if (str === ".nan") return Number.NaN;

		// Quoted string
		if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
			const inner = str.slice(1, -1);
			if (str.startsWith('"')) {
				return inner
					.replace(/\\n/g, "\n")
					.replace(/\\t/g, "\t")
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, "\\");
			}
			return inner.replace(/''/g, "'");
		}

		// Integer
		if (/^-?0x[0-9a-fA-F]+$/.test(str)) return Number.parseInt(str, 16);
		if (/^-?0o[0-7]+$/.test(str)) return Number.parseInt(str.replace("0o", ""), 8);
		if (/^-?\d+$/.test(str)) return Number.parseInt(str, 10);

		// Float
		if (/^-?\d+\.\d*([eE][+-]?\d+)?$/.test(str) || /^-?\d*\.\d+([eE][+-]?\d+)?$/.test(str)) {
			return Number.parseFloat(str);
		}

		// Plain string — strip trailing inline comment
		return this.stripComment(str);
	}
}

/** Split a flow-style string by a delimiter, respecting nesting. */
function splitFlow(text, delimiter) {
	const parts = [];
	let depth = 0;
	let current = "";
	let inSingle = false;
	let inDouble = false;
	for (const ch of text) {
		if (ch === "'" && !inDouble) {
			inSingle = !inSingle;
			current += ch;
			continue;
		}
		if (ch === '"' && !inSingle) {
			inDouble = !inDouble;
			current += ch;
			continue;
		}
		if (inSingle || inDouble) {
			current += ch;
			continue;
		}
		if (ch === "{" || ch === "[") {
			depth++;
			current += ch;
			continue;
		}
		if (ch === "}" || ch === "]") {
			depth--;
			current += ch;
			continue;
		}
		if (ch === delimiter && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function downloadFile(filename, force = false) {
	const dest = join(SWAGGER_DIR, filename);
	if (!force && (await fileExists(dest))) {
		return readFile(dest, "utf8");
	}
	const url = BASE_URL + filename;
	console.log(`  Downloading ${filename}...`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}
	const text = await response.text();
	await writeFile(dest, text, "utf8");
	return text;
}

async function downloadAllFiles(entryYaml) {
	const downloaded = new Map(); // filename -> parsed object
	const queue = [ENTRY_FILE];
	const seen = new Set([ENTRY_FILE]);

	while (queue.length > 0) {
		const filename = queue.shift();
		let text;
		if (filename === ENTRY_FILE) {
			text = entryYaml;
			await writeFile(join(SWAGGER_DIR, ENTRY_FILE), text, "utf8");
		} else {
			text = await downloadFile(filename);
		}
		const parsed = parseYaml(text);
		downloaded.set(filename, parsed);

		// Find all $ref values that point to other files
		for (const ref of collectRefs(parsed)) {
			const [refFile] = ref.split("#");
			if (refFile?.endsWith(".yaml") && !seen.has(refFile)) {
				seen.add(refFile);
				queue.push(refFile);
			}
		}
	}

	return downloaded;
}

function collectRefs(obj, refs = new Set()) {
	if (typeof obj !== "object" || obj === null) return refs;
	if (Array.isArray(obj)) {
		for (const item of obj) collectRefs(item, refs);
		return refs;
	}
	for (const [k, v] of Object.entries(obj)) {
		if (k === "$ref" && typeof v === "string") {
			refs.add(v);
		} else {
			collectRefs(v, refs);
		}
	}
	return refs;
}

// ─── REF RESOLUTION ───────────────────────────────────────────────────────────

/**
 * Resolves all $ref values within a single file's parsed YAML,
 * using the full map of all downloaded files.
 */
function resolveRefs(obj, currentFile, allFiles, visited = new Set()) {
	if (typeof obj !== "object" || obj === null) return obj;

	if ("$ref" in obj && typeof obj.$ref === "string") {
		const ref = obj.$ref;
		const [refFile, jsonPointer] = ref.split("#");

		const targetFile = refFile || currentFile;
		const targetDoc = allFiles.get(targetFile);
		if (!targetDoc) {
			console.warn(`  Warning: referenced file not found: ${targetFile}`);
			return obj;
		}

		const resolved = jsonPointer ? getByPointer(targetDoc, jsonPointer) : targetDoc;

		if (resolved === undefined) {
			console.warn(`  Warning: $ref pointer not found: ${ref}`);
			return obj;
		}

		// Avoid infinite loops from circular refs
		const key = `${targetFile}#${jsonPointer ?? ""}`;
		if (visited.has(key)) {
			// Return a reference marker so type gen can handle it
			return { __circular_ref: key, ...obj };
		}
		visited.add(key);
		const result = resolveRefs(resolved, targetFile, allFiles, new Set(visited));
		visited.delete(key);
		return result;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => resolveRefs(item, currentFile, allFiles, visited));
	}

	const result = {};
	for (const [k, v] of Object.entries(obj)) {
		result[k] = resolveRefs(v, currentFile, allFiles, visited);
	}
	return result;
}

/**
 * Navigate a JSON Pointer (e.g. /components/schemas/Foo) in an object.
 */
function getByPointer(obj, pointer) {
	if (!pointer || pointer === "/") return obj;
	const parts = pointer
		.replace(/^\//, "")
		.split("/")
		.map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
	let current = obj;
	for (const part of parts) {
		if (current === null || typeof current !== "object") return undefined;
		current = current[part];
	}
	return current;
}

// ─── SCHEMA COLLECTION ────────────────────────────────────────────────────────

/**
 * Collect all named schemas from components.schemas across all files.
 * Returns Map<schemaName, { schema, sourceFile }>
 */
function collectSchemas(allFiles) {
	const schemas = new Map(); // name -> { schema, sourceFile }
	for (const [filename, doc] of allFiles) {
		const fileSchemas = doc?.components?.schemas ?? {};
		if (typeof fileSchemas === "object") {
			for (const [name, schema] of Object.entries(fileSchemas)) {
				if (!schemas.has(name)) {
					schemas.set(name, { schema, sourceFile: filename });
				}
			}
		}
	}
	return schemas;
}

/**
 * Resolve a single $ref value to its target object.
 * Handles both cross-file refs (file.yaml#/pointer) and same-file refs (#/pointer).
 */
function resolveOneRef(ref, currentFile, allFiles) {
	const [refFile, pointer] = ref.split("#");
	const targetFile = refFile || currentFile;
	const doc = allFiles.get(targetFile);
	if (!doc) return null;
	return pointer ? getByPointer(doc, pointer) : doc;
}

// ─── OPERATION COLLECTION ────────────────────────────────────────────────────

/**
 * Extract the type name from a schema, preferring $ref names.
 * Returns a string like "ProcessInstanceResult" or null for inline/unknown.
 */
function extractTypeName(schema) {
	if (!schema || typeof schema !== "object") return null;
	if (typeof schema.$ref === "string") {
		return schema.$ref.split("/").pop() ?? null;
	}
	return null;
}

/**
 * Resolve parameters — each may be a $ref to a parameter definition.
 */
function resolveParameters(rawParams, currentFile, allFiles) {
	if (!Array.isArray(rawParams)) return [];
	return rawParams
		.map((p) => {
			if (p && typeof p.$ref === "string") {
				return resolveOneRef(p.$ref, currentFile, allFiles) ?? p;
			}
			return p;
		})
		.filter(Boolean);
}

/**
 * Build a flat list of all operations by reading unresolved files so that
 * schema $refs are preserved as type names.
 */
function collectOperations(allFiles) {
	const operations = [];
	const entry = allFiles.get(ENTRY_FILE);
	const paths = entry?.paths ?? {};

	for (const [path, pathItemRaw] of Object.entries(paths)) {
		if (!pathItemRaw || typeof pathItemRaw !== "object") continue;

		// Resolve path-level $ref (points to another file)
		let pathItem = pathItemRaw;
		let pathItemFile = ENTRY_FILE;
		if (typeof pathItemRaw.$ref === "string") {
			const [refFile, pointer] = pathItemRaw.$ref.split("#");
			pathItemFile = refFile || ENTRY_FILE;
			const doc = allFiles.get(pathItemFile);
			if (!doc) continue;
			pathItem = pointer ? getByPointer(doc, pointer) : doc;
			if (!pathItem) continue;
		}

		for (const method of ["get", "post", "put", "patch", "delete"]) {
			const op = pathItem[method];
			if (!op || typeof op !== "object") continue;

			const tags = Array.isArray(op.tags) ? op.tags : ["Default"];
			const operationId = op.operationId;
			if (!operationId) continue;

			// Parameters: merge path-level + operation-level, resolve $refs
			const pathParams = resolveParameters(pathItem.parameters, pathItemFile, allFiles);
			const opParams = resolveParameters(op.parameters, pathItemFile, allFiles);
			const parameters = [...pathParams, ...opParams];

			// Request body schema — keep as schema ref name if possible
			let requestBodySchema = null;
			const rb = op.requestBody;
			if (rb) {
				// rb may itself be a $ref
				const rbResolved =
					typeof rb.$ref === "string" ? resolveOneRef(rb.$ref, pathItemFile, allFiles) : rb;
				const content = rbResolved?.content ?? {};
				const jsonContent = content["application/json"];
				requestBodySchema = jsonContent?.schema ?? null;
			}
			const requestBodyRequired = rb?.required === true;

			// Response schema (200 or 201) — keep as schema ref name if possible
			let responseSchema = null;
			const responses = op.responses ?? {};
			for (const code of ["200", "201"]) {
				const resp = responses[code];
				if (resp) {
					// resp may be a $ref
					const respResolved =
						typeof resp.$ref === "string" ? resolveOneRef(resp.$ref, pathItemFile, allFiles) : resp;
					const content = respResolved?.content ?? {};
					const jsonContent = content["application/json"];
					responseSchema = jsonContent?.schema ?? null;
					break;
				}
			}

			const eventuallyConsistent = op["x-eventually-consistent"] === true;
			const summary = op.summary ?? "";
			const description = op.description ?? "";

			operations.push({
				path,
				method: method.toUpperCase(),
				operationId,
				tags,
				parameters,
				requestBodySchema,
				requestBodyRequired,
				responseSchema,
				eventuallyConsistent,
				summary,
				description,
			});
		}
	}
	return operations;
}

// ─── TYPE GENERATION ─────────────────────────────────────────────────────────

const RESERVED_WORDS = new Set([
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"export",
	"extends",
	"finally",
	"for",
	"function",
	"if",
	"import",
	"in",
	"instanceof",
	"let",
	"new",
	"null",
	"return",
	"static",
	"super",
	"switch",
	"this",
	"throw",
	"try",
	"typeof",
	"undefined",
	"var",
	"void",
	"while",
	"with",
	"yield",
	"enum",
	"implements",
	"interface",
	"package",
	"private",
	"protected",
	"public",
	"type",
]);

function safePropName(name) {
	if (RESERVED_WORDS.has(name) || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
		return `"${name}"`;
	}
	return name;
}

function schemaToTs(schema, schemas, depth = 0, seen = new Set()) {
	if (!schema || typeof schema !== "object") return "unknown";

	// Handle circular refs
	if ("__circular_ref" in schema) {
		return "unknown /* circular */";
	}

	// $ref (shouldn't appear after resolution, but just in case)
	if ("$ref" in schema && typeof schema.$ref === "string") {
		const name = schema.$ref.split("/").pop();
		return name ?? "unknown";
	}

	// allOf — merge/intersection
	if (schema.allOf && Array.isArray(schema.allOf)) {
		const parts = schema.allOf.map((s) => schemaToTs(s, schemas, depth, seen));
		const unique = [...new Set(parts.filter((p) => p !== "unknown"))];
		if (unique.length === 0) return "unknown";
		if (unique.length === 1) return unique[0];
		// If all are objects, produce merged object type
		if (unique.every((p) => p.startsWith("{"))) {
			return mergeObjectTypes(schema.allOf, schemas, depth, seen);
		}
		return unique.join(" & ");
	}

	// oneOf / anyOf — union
	for (const key of ["oneOf", "anyOf"]) {
		if (schema[key] && Array.isArray(schema[key])) {
			const parts = schema[key].map((s) => schemaToTs(s, schemas, depth, seen));
			const unique = [...new Set(parts)];
			if (unique.length === 1) return unique[0];
			return unique.join(" | ");
		}
	}

	// Enum
	if (schema.enum && Array.isArray(schema.enum)) {
		return schema.enum.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
	}

	// nullable (OpenAPI 3.0)
	const nullable = schema.nullable === true;
	const nullSuffix = nullable ? " | null" : "";

	// type: array
	if (schema.type === "array") {
		const items = schema.items ? schemaToTs(schema.items, schemas, depth, seen) : "unknown";
		return `Array<${items}>${nullSuffix}`;
	}

	// type: object (or implicit object from properties)
	if (schema.type === "object" || schema.properties || schema.additionalProperties !== undefined) {
		const props = schema.properties ?? {};
		const required = new Set(Array.isArray(schema.required) ? schema.required : []);
		const lines = [];

		for (const [propName, propSchema] of Object.entries(props)) {
			const isRequired = required.has(propName);
			const tsType = schemaToTs(propSchema, schemas, depth + 1, seen);
			const desc = propSchema?.description;
			if (desc) lines.push(`  /** ${desc.replace(/\*\//g, "*")} */`);
			lines.push(`  ${safePropName(propName)}${isRequired ? "" : "?"}: ${tsType};`);
		}

		// additionalProperties
		if (schema.additionalProperties === true) {
			lines.push("  [key: string]: unknown;");
		} else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
			const valType = schemaToTs(schema.additionalProperties, schemas, depth + 1, seen);
			lines.push(`  [key: string]: ${valType};`);
		}

		if (lines.length === 0) {
			return `Record<string, unknown>${nullSuffix}`;
		}

		const indent = "  ".repeat(depth);
		return `{\n${lines.map((l) => `${indent}  ${l}`).join("\n")}\n${indent}}${nullSuffix}`;
	}

	// Primitives
	switch (schema.type) {
		case "string": {
			if (schema.format === "binary") return `Blob${nullSuffix}`;
			return `string${nullSuffix}`;
		}
		case "integer":
		case "number":
			return `number${nullSuffix}`;
		case "boolean":
			return `boolean${nullSuffix}`;
		case "null":
			return "null";
	}

	// Format hints
	if (schema.format === "binary") return "Blob";
	if (schema.format === "date-time" || schema.format === "date") return `string${nullSuffix}`;

	return `unknown${nullSuffix}`;
}

function mergeObjectTypes(schemas, allSchemas, depth, seen) {
	const lines = [];
	for (const s of schemas) {
		if (!s || typeof s !== "object") continue;
		const props = s.properties ?? {};
		const required = new Set(Array.isArray(s.required) ? s.required : []);
		for (const [propName, propSchema] of Object.entries(props)) {
			const isRequired = required.has(propName);
			const tsType = schemaToTs(propSchema, allSchemas, depth + 1, seen);
			lines.push(`  ${safePropName(propName)}${isRequired ? "" : "?"}: ${tsType};`);
		}
	}
	return `{\n${lines.join("\n")}\n}`;
}

function generateTypes(schemas) {
	const lines = [
		"// This file is auto-generated by scripts/generate.mjs",
		"// Do not edit manually. Run `pnpm --filter @bpmn-sdk/api generate` to regenerate.",
		"",
	];

	for (const [name, schema] of schemas) {
		if (!schema || typeof schema !== "object") continue;
		const desc = schema.description;
		if (desc) {
			lines.push(`/** ${desc.replace(/\*\//g, "*").replace(/\n/g, "\n * ")} */`);
		}

		const tsType = schemaToTs(schema, schemas, 0, new Set());

		// Use `interface` only for plain object types (not unions/intersections)
		const isPlainObject =
			tsType.startsWith("{") && !tsType.includes("} |") && !tsType.includes("} &");
		if (isPlainObject) {
			lines.push(`export interface ${name} ${tsType}`);
		} else {
			lines.push(`export type ${name} = ${tsType};`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ─── RESOURCE / CLIENT GENERATION ────────────────────────────────────────────

function tagToClassName(tag) {
	return `${tag
		.split(/[\s\-_]+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join("")}Resource`;
}

function tagToPropertyName(tag) {
	const parts = tag.split(/[\s\-_]+/);
	const camel = parts
		.map((w, i) =>
			i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
		)
		.join("");
	// Pluralise the last word for natural API: client.processInstances (not client.processInstance)
	return camel;
}

function operationToMethodName(operationId) {
	// operationId is already camelCase in the Camunda API
	return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}

function schemaToTsRef(schema) {
	if (!schema || typeof schema !== "object") return "unknown";
	if ("__circular_ref" in schema) return "unknown";
	// If the schema is a $ref, use the referenced type name directly
	if (typeof schema.$ref === "string") {
		return schema.$ref.split("/").pop() ?? "unknown";
	}
	if (schema.type === "array") {
		const items = schemaToTsRef(schema.items ?? {});
		return `Array<${items}>`;
	}
	if (schema.allOf || schema.oneOf || schema.anyOf || schema.enum) {
		return schemaToTs(schema, new Map(), 0, new Set());
	}
	if (schema.type === "object" || schema.properties) {
		return schemaToTs(schema, new Map(), 0, new Set());
	}
	switch (schema.type) {
		case "string":
			return "string";
		case "integer":
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		default:
			return "unknown";
	}
}

/**
 * Prefix a type name with "Types." when it looks like a named schema type
 * (not a primitive, not an inline type starting with { or Array<...).
 */
function withTypesNs(tsType) {
	if (!tsType) return tsType;
	// Recurse into Array<X>
	if (tsType.startsWith("Array<") && tsType.endsWith(">")) {
		const inner = tsType.slice(6, -1);
		return `Array<${withTypesNs(inner)}>`;
	}
	// Inline types and primitives — leave as-is
	if (
		tsType.startsWith("{") ||
		tsType.startsWith("(") ||
		tsType === "string" ||
		tsType === "number" ||
		tsType === "boolean" ||
		tsType === "unknown" ||
		tsType === "void" ||
		tsType === "null" ||
		tsType.startsWith('"') ||
		tsType.includes(" | ") ||
		tsType.includes(" & ")
	) {
		return tsType;
	}
	return `Types.${tsType}`;
}

function buildParamList(parameters, requestBodySchema, requestBodyRequired) {
	const pathParams = parameters.filter((p) => p?.in === "path");
	const queryParams = parameters.filter((p) => p?.in === "query");

	const parts = [];

	// Path parameters first (always required)
	for (const p of pathParams) {
		const name = p.name;
		const schema = p.schema ?? {};
		const tsType =
			schema.type === "integer" || schema.type === "number" ? "number | string" : "string";
		parts.push(`${name}: ${tsType}`);
	}

	// Request body
	if (requestBodySchema) {
		const tsType = withTypesNs(schemaToTsRef(requestBodySchema));
		const optional = requestBodyRequired ? "" : "?";
		parts.push(`body${optional}: ${tsType}`);
	}

	// Query params as optional object
	if (queryParams.length > 0) {
		const qParts = queryParams.map((p) => {
			const qSchema = p.schema ?? {};
			const qType = withTypesNs(schemaToTsRef(qSchema));
			const optional = p.required ? "" : "?";
			return `${safePropName(p.name)}${optional}: ${qType}`;
		});
		parts.push(`query?: { ${qParts.join("; ")} }`);
	}

	return parts;
}

function buildMethodBody(op) {
	const pathParams = op.parameters.filter((p) => p?.in === "path");
	const queryParams = op.parameters.filter((p) => p?.in === "query");

	const lines = [];
	lines.push("    return this._http.request({");
	lines.push(`      method: "${op.method}",`);

	// Path with parameter interpolation
	if (pathParams.length > 0) {
		const pathLiteral = op.path.replace(/{(\w+)}/g, (_, name) => `\${${name}}`);
		lines.push(`      path: \`${pathLiteral}\`,`);
	} else {
		lines.push(`      path: "${op.path}",`);
	}

	if (op.requestBodySchema) {
		lines.push("      body,");
	}

	if (queryParams.length > 0) {
		lines.push("      query: query as Record<string, unknown> | undefined,");
	}

	if (op.eventuallyConsistent) {
		lines.push("      cacheable: true,");
	}

	lines.push("    });");
	return lines.join("\n");
}

function generateResources(operations, allTags) {
	// Group operations by first tag
	const byTag = new Map();
	for (const op of operations) {
		const tag = op.tags[0] ?? "Default";
		if (!byTag.has(tag)) byTag.set(tag, []);
		byTag.get(tag).push(op);
	}

	const lines = [
		"// This file is auto-generated by scripts/generate.mjs",
		"// Do not edit manually. Run `pnpm --filter @bpmn-sdk/api generate` to regenerate.",
		"",
		'import type { CamundaClientInput } from "../runtime/types.js";',
		'import { CamundaBaseClient } from "../runtime/client.js";',
		'import { ResourceBase } from "../runtime/client.js";',
		'import type * as Types from "./types.js";',
		"",
	];

	const resourceClasses = [];

	for (const [tag, ops] of byTag) {
		const className = tagToClassName(tag);
		resourceClasses.push({ tag, className, propertyName: tagToPropertyName(tag) });

		lines.push(`// ── ${tag} ──`);
		lines.push(`export class ${className} extends ResourceBase {`);

		for (const op of ops) {
			const methodName = operationToMethodName(op.operationId);
			const returnType = op.responseSchema ? withTypesNs(schemaToTsRef(op.responseSchema)) : "void";
			const paramList = buildParamList(op.parameters, op.requestBodySchema, op.requestBodyRequired);

			// JSDoc
			if (op.summary || op.description) {
				lines.push("  /**");
				if (op.summary) lines.push(`   * ${op.summary}`);
				if (op.description && op.description !== op.summary) {
					lines.push("   *");
					for (const descLine of op.description.split("\n").slice(0, 3)) {
						lines.push(`   * ${descLine}`);
					}
				}
				lines.push(`   * @see ${op.method} ${op.path}`);
				lines.push("   */");
			}

			lines.push(`  async ${methodName}(${paramList.join(", ")}): Promise<${returnType}> {`);
			lines.push(buildMethodBody(op));
			lines.push("  }");
			lines.push("");
		}

		lines.push("}");
		lines.push("");
	}

	// Generate CamundaClient class
	lines.push("/**");
	lines.push(" * Camunda Orchestration Cluster API client.");
	lines.push(" *");
	lines.push(" * @example");
	lines.push(" * ```typescript");
	lines.push(" * const client = new CamundaClient({");
	lines.push(' *   baseUrl: "http://localhost:8080/v2",');
	lines.push(' *   auth: { type: "bearer", token: "my-token" },');
	lines.push(" * });");
	lines.push(" *");
	lines.push(" * const instances = await client.processInstances.search({});");
	lines.push(" * ```");
	lines.push(" */");
	lines.push("export class CamundaClient extends CamundaBaseClient {");

	// Resource properties (declarations)
	for (const { tag, className, propertyName } of resourceClasses) {
		lines.push(`  /** ${tag} operations */`);
		lines.push(`  readonly ${propertyName}: ${className};`);
	}
	lines.push("");

	lines.push("  constructor(config: CamundaClientInput = {}) {");
	lines.push("    super(config);");
	for (const { className, propertyName } of resourceClasses) {
		lines.push(`    this.${propertyName} = new ${className}(this.http);`);
	}
	lines.push("  }");
	lines.push("}");

	return lines.join("\n");
}

// ─── CLI COMMAND GENERATION ───────────────────────────────────────────────────

const CLI_GENERATED_DIR = join(ROOT, "..", "..", "apps", "cli", "src", "generated");

/** Aliases for common group names shown in CLI help. */
const CLI_GROUP_ALIASES = {
	"process-instance": ["pi"],
	"process-definition": ["pd"],
	"user-task": ["ut"],
	variable: ["var"],
	authorization: ["auth"],
	"batch-operation": ["batch"],
	"element-instance": ["element"],
	"mapping-rule": ["mapping"],
	"decision-definition": ["dd"],
};

/** Verb remapping: OpenAPI verb → CLI command name. */
const VERB_REMAP = { search: "list" };

/** Convert a tag name to a CLI group name (kebab-case). */
function tagToCliGroupName(tag) {
	return tag.toLowerCase().replace(/[\s_]+/g, "-");
}

/**
 * Try to strip the entity PascalCase name from an operationId.
 * Returns the CLI command name or null if no match.
 */
function tryStripEntity(operationId, entityPascal) {
	const escaped = entityPascal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escaped}s?`);
	if (!regex.test(operationId)) return null;

	const withMarker = operationId.replace(regex, "\x00");
	const [before, after] = withMarker.split("\x00");
	const verb = before || "";
	const suffix = after || "";

	const subKebab = suffix
		.replace(/([A-Z])/g, "-$1")
		.toLowerCase()
		.replace(/^-/, "");
	const verbLower = verb.toLowerCase();
	const mappedVerb = VERB_REMAP[verbLower] || verbLower;

	if (!mappedVerb && !subKebab) return null;
	return subKebab ? `${mappedVerb}-${subKebab}` : mappedVerb;
}

/** Derive the CLI command name from an operationId and its tag. */
function operationToCliCommandName(operationId, tag) {
	const tagWords = tag.split(/[\s\-_]+/);
	const fullEntity = tagWords
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join("");

	// Try full entity name first
	let name = tryStripEntity(operationId, fullEntity);

	// Try with just the first word of the entity name
	if (name === null && tagWords.length > 1) {
		const firstWord = tagWords[0].charAt(0).toUpperCase() + tagWords[0].slice(1).toLowerCase();
		name = tryStripEntity(operationId, firstWord);
	}

	// Fall back to full operationId converted to kebab-case
	if (name === null) {
		name = operationId
			.replace(/([A-Z])/g, "-$1")
			.toLowerCase()
			.replace(/^-/, "");
	}

	return name;
}

/** Classify an operation into a CLI command type. */
function detectCmdType(op) {
	const pathParams = op.parameters.filter((p) => p?.in === "path");
	// List: POST /…/search with no path params (sub-resource searches are actions)
	if (op.method === "POST" && op.path.endsWith("/search") && pathParams.length === 0) return "list";
	// Get: exactly 1 path param, no body — multi-param GETs are actions
	if (op.method === "GET" && pathParams.length === 1) return "get";
	// Create: POST to base path, no path params, no body schema needed (may be multipart)
	if (op.method === "POST" && pathParams.length === 0 && !op.path.endsWith("/search"))
		return "create";
	// Update: exactly 1 path param
	if ((op.method === "PATCH" || op.method === "PUT") && pathParams.length === 1) return "update";
	// Delete: exactly 1 path param
	if (op.method === "DELETE" && pathParams.length === 1) return "delete";
	return "action";
}

/**
 * Derive column definitions from a list-operation response schema.
 * Resolves the response type → items array → item properties.
 */
function deriveColumns(responseSchema, schemas) {
	if (!responseSchema) return [];
	const typeName =
		typeof responseSchema.$ref === "string" ? responseSchema.$ref.split("/").pop() : null;
	if (!typeName) return [];

	const responseResolved = schemas.get(typeName);
	if (!responseResolved || typeof responseResolved !== "object") return [];

	const props = responseResolved.properties;
	if (!props || typeof props !== "object") return [];

	const itemsProp = props.items;
	if (!itemsProp || typeof itemsProp !== "object") return [];

	let itemProperties = null;
	if (itemsProp.type === "array" && itemsProp.items && typeof itemsProp.items === "object") {
		itemProperties = itemsProp.items.properties || null;
	}
	if (!itemProperties || Object.keys(itemProperties).length === 0) return [];

	const columns = [];
	for (const [propName, propSchema] of Object.entries(itemProperties)) {
		if (!propSchema || typeof propSchema !== "object") continue;
		const isDate = /[Dd]ate$|[Tt]ime$/.test(propName) || propSchema.format === "date-time";
		const isKeyOrId = /[Kk]ey$|Id$/.test(propName);
		const isString = propSchema.type === "string";
		columns.push({
			key: propName,
			header: propName
				.replace(/([A-Z])/g, " $1")
				.trim()
				.toUpperCase(),
			dateTransform: isDate,
			maxWidth: isString && !isDate && !isKeyOrId ? 30 : null,
		});
	}

	columns.sort((a, b) => {
		const score = (k) => {
			const lo = k.toLowerCase();
			if (lo.endsWith("key")) return 0;
			if (lo === "state" || lo === "status") return 1;
			if (lo.endsWith("id")) return 2;
			if (lo.includes("name")) return 3;
			if (lo.includes("date") || lo.includes("time")) return 9;
			return 5;
		};
		return score(a.key) - score(b.key);
	});

	return columns.slice(0, 7);
}

/** Generate the full contents of apps/cli/src/generated/commands.ts. */
function generateCliCommandsContent(operations, schemas, tagDescriptions) {
	const byTag = new Map();
	for (const op of operations) {
		const tag = op.tags[0] ?? "Default";
		if (!byTag.has(tag)) byTag.set(tag, []);
		byTag.get(tag).push(op);
	}

	const lines = [
		"// This file is auto-generated by packages/api/scripts/generate.mjs",
		"// Do not edit manually.",
		"",
		'import type { CommandGroup } from "../types.js";',
		'import { dateTransform } from "../output.js";',
		"import {",
		"  DATA_FLAG,",
		"  DATA_OPT_FLAG,",
		"  makeListCmd,",
		"  makeGetCmd,",
		"  makeCreateCmd,",
		"  makeUpdateCmd,",
		"  makeDeleteCmd,",
		"  parseJson,",
		'} from "../commands/shared.js";',
		"",
	];

	const groupVarNames = [];

	for (const [tag, ops] of byTag) {
		const groupName = tagToCliGroupName(tag);
		const clientProp = tagToPropertyName(tag);
		const aliases = CLI_GROUP_ALIASES[groupName] || [];
		const description = tagDescriptions[tag] || tag;
		const varName = `${clientProp}Group`;
		groupVarNames.push(varName);

		const usedNames = new Set();
		lines.push(`// ── ${tag} ──`);
		lines.push(`export const ${varName}: CommandGroup = {`);
		lines.push(`  name: "${groupName}",`);
		if (aliases.length > 0) lines.push(`  aliases: ${JSON.stringify(aliases)},`);
		lines.push(`  description: ${JSON.stringify(description)},`);
		lines.push("  commands: [");

		for (const op of ops) {
			// Derive and deduplicate command name
			let cmdName = operationToCliCommandName(op.operationId, tag);
			if (usedNames.has(cmdName)) {
				let n = 2;
				while (usedNames.has(`${cmdName}-${n}`)) n++;
				cmdName = `${cmdName}-${n}`;
			}
			usedNames.add(cmdName);

			const methodName = operationToMethodName(op.operationId);
			const pathParams = op.parameters.filter((p) => p?.in === "path");
			const keyParam = pathParams[0]?.name || "key";
			const desc =
				op.summary ||
				(typeof op.description === "string" ? op.description.split("\n")[0] : "") ||
				cmdName;
			const cmdType = detectCmdType(op);

			if (cmdType === "list") {
				const columns = deriveColumns(op.responseSchema, schemas);
				lines.push("    makeListCmd({");
				if (cmdName !== "list") lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				lines.push("      columns: [");
				for (const col of columns) {
					let colStr = `{ key: "${col.key}", header: "${col.header}"`;
					if (col.maxWidth) colStr += `, maxWidth: ${col.maxWidth}`;
					if (col.dateTransform) colStr += ", transform: dateTransform";
					colStr += " }";
					lines.push(`        ${colStr},`);
				}
				lines.push("      ],");
				lines.push(
					`      search: (client, body) => client.${clientProp}.${methodName}(body as never),`,
				);
				lines.push("    }),");
			} else if (cmdType === "get") {
				lines.push("    makeGetCmd({");
				if (cmdName !== "get") lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				lines.push(`      argName: "${keyParam}",`);
				lines.push(`      get: (client, key) => client.${clientProp}.${methodName}(key),`);
				lines.push("    }),");
			} else if (cmdType === "create") {
				lines.push("    makeCreateCmd({");
				if (cmdName !== "create") lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				// Only pass body if the API method actually accepts one
				const createBodyArg = op.requestBodySchema ? "body as never" : "";
				lines.push(
					`      create: (client, body) => client.${clientProp}.${methodName}(${createBodyArg}),`,
				);
				lines.push("    }),");
			} else if (cmdType === "update") {
				lines.push("    makeUpdateCmd({");
				if (cmdName !== "update") lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				lines.push(`      argName: "${keyParam}",`);
				lines.push(
					`      update: (client, key, body) => client.${clientProp}.${methodName}(key, body as never),`,
				);
				lines.push("    }),");
			} else if (cmdType === "delete") {
				lines.push("    makeDeleteCmd({");
				if (cmdName !== "delete") lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				lines.push(`      argName: "${keyParam}",`);
				if (op.requestBodySchema) {
					lines.push("      extraFlags: [],");
					lines.push(
						`      delete: (client, key, body) => client.${clientProp}.${methodName}(key, body as never),`,
					);
				} else {
					lines.push(`      delete: (client, key) => client.${clientProp}.${methodName}(key),`);
				}
				lines.push("    }),");
			} else {
				// Generic action command
				const hasBody = !!op.requestBodySchema;
				const bodyRequired = op.requestBodyRequired;
				lines.push("    {");
				lines.push(`      name: ${JSON.stringify(cmdName)},`);
				lines.push(`      description: ${JSON.stringify(desc)},`);
				if (pathParams.length > 0) {
					const argsStr = pathParams
						.map((p) => `{ name: "${p.name}", description: "${p.name}", required: true }`)
						.join(", ");
					lines.push(`      args: [${argsStr}],`);
				}
				if (hasBody) {
					lines.push(`      flags: [${bodyRequired ? "DATA_FLAG" : "DATA_OPT_FLAG"}],`);
				}
				lines.push("      async run(ctx) {");
				for (let i = 0; i < pathParams.length; i++) {
					const p = pathParams[i];
					lines.push(`        const ${p.name} = ctx.positional[${i}];`);
					lines.push(
						`        if (!${p.name}) throw new Error("Missing required argument: <${p.name}>");`,
					);
				}
				if (hasBody) {
					lines.push(
						'        const body = parseJson(ctx.flags.data as string | undefined, "data");',
					);
				}
				lines.push("        const client = await ctx.getClient();");
				const callArgs = [
					...pathParams.map((p) => p.name),
					...(hasBody ? ["body as never"] : []),
				].join(", ");
				if (op.responseSchema) {
					lines.push(
						`        const result = await client.${clientProp}.${methodName}(${callArgs});`,
					);
					lines.push("        ctx.output.printItem(result);");
				} else {
					lines.push(`        await client.${clientProp}.${methodName}(${callArgs});`);
					lines.push(`        ctx.output.ok(${JSON.stringify(`${cmdName} completed.`)});`);
				}
				lines.push("      },");
				lines.push("    },");
			}
		}

		lines.push("  ],");
		lines.push("};");
		lines.push("");
	}

	lines.push("export const generatedCommandGroups: CommandGroup[] = [");
	for (const varName of groupVarNames) {
		lines.push(`  ${varName},`);
	}
	lines.push("];");
	lines.push("");

	return lines.join("\n");
}

/** Generate the full contents of apps/cli/DOCUMENTATION.md. */
function generateCliDocumentationContent(operations, tagDescriptions) {
	const byTag = new Map();
	for (const op of operations) {
		const tag = op.tags[0] ?? "Default";
		if (!byTag.has(tag)) byTag.set(tag, []);
		byTag.get(tag).push(op);
	}

	const lines = [
		"# casen — Command Reference",
		"",
		"> This file is auto-generated by `packages/api/scripts/generate.mjs`.",
		"> Do not edit manually — re-run `pnpm build` to regenerate.",
		"",
		"## Global flags",
		"",
		"Available on every command:",
		"",
		"| Flag | Short | Description |",
		"|------|-------|-------------|",
		"| `--profile <NAME>` | `-p` | Use a specific named profile |",
		"| `--output <FORMAT>` | `-o` | Output format: `table` \\| `json` \\| `yaml` (default: `table`) |",
		"| `--no-color` | | Disable colored output |",
		"| `--debug` | | Print request details and full stack traces on error |",
		"| `--help` | `-h` | Show help for the current command |",
		"",
		"## Resources",
		"",
	];

	// Resource index table
	lines.push("| Resource | Alias | Description |");
	lines.push("|----------|-------|-------------|");
	for (const [tag] of byTag) {
		const groupName = tagToCliGroupName(tag);
		const aliases = CLI_GROUP_ALIASES[groupName] || [];
		const description = tagDescriptions[tag] || tag;
		const aliasStr = aliases.length > 0 ? aliases.map((a) => `\`${a}\``).join(", ") : "";
		const anchor = groupName.replace(/-/g, "");
		lines.push(`| [\`${groupName}\`](#${anchor}) | ${aliasStr} | ${description} |`);
	}
	lines.push("");

	// One section per resource
	for (const [tag, ops] of byTag) {
		const groupName = tagToCliGroupName(tag);
		const aliases = CLI_GROUP_ALIASES[groupName] || [];
		const description = tagDescriptions[tag] || tag;

		const aliasStr = aliases.length > 0 ? ` (${aliases.map((a) => `\`${a}\``).join(", ")})` : "";
		lines.push(`## \`${groupName}\`${aliasStr}`);
		lines.push("");
		lines.push(description);
		lines.push("");
		lines.push("| Command | Args | Flags | Description |");
		lines.push("|---------|------|-------|-------------|");

		const usedNames = new Set();
		for (const op of ops) {
			let cmdName = operationToCliCommandName(op.operationId, tag);
			if (usedNames.has(cmdName)) {
				let n = 2;
				while (usedNames.has(`${cmdName}-${n}`)) n++;
				cmdName = `${cmdName}-${n}`;
			}
			usedNames.add(cmdName);

			const pathParams = op.parameters.filter((p) => p?.in === "path");
			const cmdType = detectCmdType(op);
			const hasBody = !!op.requestBodySchema;
			const bodyRequired = op.requestBodyRequired;
			const desc =
				op.summary ||
				(typeof op.description === "string" ? op.description.split("\n")[0] : "") ||
				cmdName;

			const argsCol =
				cmdType === "get" || cmdType === "update" || cmdType === "delete"
					? `\`<${pathParams[0]?.name || "key"}>\``
					: pathParams.length > 0
						? pathParams.map((p) => `\`<${p.name}>\``).join(" ")
						: "";

			const flagParts = [];
			if (cmdType === "list") flagParts.push("`--filter`", "`--limit`", "`--sort-by`");
			if (hasBody) flagParts.push(bodyRequired ? "`--data` \\*" : "`--data`");
			const flagsCol = flagParts.join(" ");

			lines.push(`| \`${cmdName}\` | ${argsCol} | ${flagsCol} | ${desc} |`);
		}

		lines.push("");
		lines.push(`> \`casen ${groupName} <command> --help\` for full flag details.`);
		lines.push("");
	}

	// Manual resources
	lines.push("## `profile`");
	lines.push("");
	lines.push("Manage named connection profiles stored in the OS config directory.");
	lines.push("");
	lines.push("| Command | Args | Flags | Description |");
	lines.push("|---------|------|-------|-------------|");
	lines.push(
		"| `create` | `<name>` | `--base-url` `--auth-type` `--token` … | Create or update a profile |",
	);
	lines.push("| `list` | | | List all profiles |");
	lines.push("| `use` | `<name>` | | Switch the active profile |");
	lines.push("| `show` | | | Show the active profile |");
	lines.push("| `delete` | `<name>` | | Delete a profile |");
	lines.push("");
	lines.push("> `casen profile <command> --help` for full flag details.");
	lines.push("");

	lines.push("## `completion`");
	lines.push("");
	lines.push("Generate shell completion scripts.");
	lines.push("");
	lines.push("| Command | Description |");
	lines.push("|---------|-------------|");
	lines.push("| `bash` | Print bash completion script |");
	lines.push("| `zsh` | Print zsh completion script |");
	lines.push("| `fish` | Print fish completion script |");
	lines.push("");

	lines.push("---");
	lines.push("");
	lines.push(`_Generated from ${operations.length} operations across ${byTag.size} API tags._`);
	lines.push("");

	return lines.join("\n");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log("Camunda API Generator");
	console.log("=====================");

	// Ensure directories exist
	await mkdir(SWAGGER_DIR, { recursive: true });
	await mkdir(GENERATED_DIR, { recursive: true });

	// 1. Download all YAML files
	console.log("\n1. Downloading OpenAPI specs...");
	const entryYaml = await downloadFile(ENTRY_FILE, true);
	const allFiles = await downloadAllFiles(entryYaml);
	console.log(`   Downloaded ${allFiles.size} files.`);

	// 2. Collect schemas from all files, resolving refs with correct file context
	console.log("\n2. Collecting and resolving schemas...");
	const rawSchemas = collectSchemas(allFiles);
	// Resolve refs within each schema using the schema's source file as context
	const schemas = new Map();
	for (const [name, { schema, sourceFile }] of rawSchemas) {
		schemas.set(name, resolveRefs(schema, sourceFile, allFiles));
	}
	console.log(`   Found ${schemas.size} schemas.`);

	// 3. Collect operations from unresolved files (preserves $ref schema names)
	console.log("\n3. Collecting operations...");
	const operations = collectOperations(allFiles);
	console.log(`   Found ${operations.length} operations.`);

	// 5. Generate types
	console.log("\n5. Generating types...");
	const typesContent = generateTypes(schemas);
	const typesPath = join(GENERATED_DIR, "types.ts");
	await writeFile(typesPath, typesContent, "utf8");
	console.log("   Written: src/generated/types.ts");

	// 6. Generate resources
	console.log("\n6. Generating resources...");
	const entryDoc = allFiles.get(ENTRY_FILE);
	const allTags = Array.isArray(entryDoc?.tags)
		? entryDoc.tags.map((t) => t?.name ?? "").filter(Boolean)
		: [];
	const resourcesContent = generateResources(operations, allTags);
	const resourcesPath = join(GENERATED_DIR, "resources.ts");
	await writeFile(resourcesPath, resourcesContent, "utf8");
	console.log("   Written: src/generated/resources.ts");

	// 7. Generate CLI commands
	console.log("\n7. Generating CLI commands...");
	await mkdir(CLI_GENERATED_DIR, { recursive: true });
	const tagDescriptions = {};
	if (Array.isArray(entryDoc?.tags)) {
		for (const t of entryDoc.tags) {
			if (t?.name) tagDescriptions[t.name] = t.description || t.name;
		}
	}
	const cliContent = generateCliCommandsContent(operations, schemas, tagDescriptions);
	await writeFile(join(CLI_GENERATED_DIR, "commands.ts"), cliContent, "utf8");
	console.log("   Written: apps/cli/src/generated/commands.ts");

	const docContent = generateCliDocumentationContent(operations, tagDescriptions);
	const CLI_DIR = join(ROOT, "..", "..", "apps", "cli");
	await writeFile(join(CLI_DIR, "DOCUMENTATION.md"), docContent, "utf8");
	console.log("   Written: apps/cli/DOCUMENTATION.md");

	console.log("\nDone.");
}

main().catch((err) => {
	console.error("Generator failed:", err);
	process.exit(1);
});
