import { describe, expect, it } from "vitest"
import { buildTemplate, buildTemplates } from "../src/build-template.js"
import { detectDefaultAuth, getOperations, parseOpenApi } from "../src/parse-openapi.js"
import type { GeneratorOptions, OperationWithMeta } from "../src/types.js"

// ─── Minimal spec fixture ─────────────────────────────────────────────────────

const MINIMAL_SPEC = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
servers:
  - url: https://api.example.com
paths:
  /items:
    get:
      operationId: listItems
      summary: List items
      parameters:
        - name: page
          in: query
          schema: { type: integer }
        - name: limit
          in: query
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  name: { type: string }
  /items/{id}:
    get:
      operationId: getItem
      summary: Get item
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: OK
    delete:
      operationId: deleteItem
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "204":
          description: Deleted
  /items/{id}/notes:
    post:
      operationId: createNote
      summary: Create note
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [text]
              properties:
                text: { type: string, description: "Note text" }
                pinned: { type: boolean }
      responses:
        "201":
          description: Created
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
`

const OPTS: GeneratorOptions = { idPrefix: "io.test" }

// ─── parseOpenApi ─────────────────────────────────────────────────────────────

describe("parseOpenApi", () => {
	it("parses YAML", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		expect(doc.info.title).toBe("Test API")
	})

	it("parses JSON", () => {
		const doc = parseOpenApi(
			JSON.stringify({ openapi: "3.0.0", info: { title: "T", version: "1" }, paths: {} }),
		)
		expect(doc.info.title).toBe("T")
	})

	it("throws on invalid JSON", () => {
		expect(() => parseOpenApi("{bad json}")).toThrow("Failed to parse")
	})

	it("rejects Swagger 2.x via getOperations", () => {
		const doc = parseOpenApi(
			JSON.stringify({ swagger: "2.0", info: { title: "T", version: "1" }, paths: {} }),
		)
		expect(() => getOperations(doc)).toThrow("OpenAPI 2.x")
	})
})

// ─── getOperations ────────────────────────────────────────────────────────────

describe("getOperations", () => {
	it("returns all operations", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		expect(ops).toHaveLength(4)
	})

	it("filters by operationId", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		// Filter on exact operationId prefix — "listItems" matches, "createNote" does not
		// Note: filter also searches path, so /items/{id}/notes would match "item"; use a
		// more specific pattern that only matches operationId words.
		const ops = getOperations(doc, "\\blistItems\\b")
		const ids = ops.map((o) => o.operation.operationId)
		expect(ids).toContain("listItems")
		expect(ids).not.toContain("createNote")
	})

	it("resolves path params", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		const getItem = ops.find((o) => o.operation.operationId === "getItem")
		if (!getItem) throw new Error("getItem not found")
		expect(getItem.pathParams).toHaveLength(1)
		expect(getItem.pathParams[0]?.name).toBe("id")
	})

	it("resolves query params", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		const list = ops.find((o) => o.operation.operationId === "listItems")
		if (!list) throw new Error("listItems not found")
		expect(list.queryParams).toHaveLength(2)
	})

	it("resolves base URL", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		expect(ops[0]?.baseUrl).toBe("https://api.example.com")
	})
})

// ─── detectDefaultAuth ────────────────────────────────────────────────────────

describe("detectDefaultAuth", () => {
	it("detects bearer from security schemes", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		expect(detectDefaultAuth(doc)).toBe("bearer")
	})

	it("returns noAuth when no schemes", () => {
		const doc = parseOpenApi(`
openapi: "3.0.0"
info: { title: T, version: "1" }
paths: {}
`)
		expect(detectDefaultAuth(doc)).toBe("noAuth")
	})
})

// ─── buildTemplate ────────────────────────────────────────────────────────────

describe("buildTemplate", () => {
	function getOp(id: string): OperationWithMeta {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		const op = ops.find((o) => o.operation.operationId === id)
		if (!op) throw new Error(`op ${id} not found`)
		return op
	}

	it("sets job type to io.camunda:http-json:1", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const jobType = tpl.properties.find(
			(p) => p.binding.type === "zeebe:taskDefinition" && p.binding.property === "type",
		)
		expect(jobType?.value).toBe("io.camunda:http-json:1")
	})

	it("sets method as Hidden", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const method = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "method",
		)
		expect(method?.value).toBe("GET")
		expect(method?.type).toBe("Hidden")
	})

	it("generates hidden URL when no path params", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const url = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "url",
		)
		expect(url?.type).toBe("Hidden")
		expect(url?.value).toBe("https://api.example.com/items")
	})

	it("generates FEEL URL when path params exist", () => {
		const tpl = buildTemplate(getOp("getItem"), OPTS)
		const url = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "url",
		)
		expect(url?.type).toBe("String")
		expect(url?.feel).toBe("optional")
		expect(String(url?.value)).toMatch(/^=/)
		expect(String(url?.value)).toContain("id")
	})

	it("includes individual path param fields", () => {
		const tpl = buildTemplate(getOp("getItem"), OPTS)
		const idField = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "id",
		)
		expect(idField).toBeDefined()
		expect(idField?.type).toBe("String")
	})

	it("includes query params field", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const qp = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "queryParameters",
		)
		expect(qp).toBeDefined()
	})

	it("omits payload group for GET/DELETE", () => {
		const tpl = buildTemplate(getOp("deleteItem"), OPTS)
		const bodyField = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "body",
		)
		expect(bodyField).toBeUndefined()
		expect(tpl.groups.find((g) => g.id === "payload")).toBeUndefined()
	})

	it("includes body field for POST", () => {
		const tpl = buildTemplate(getOp("createNote"), OPTS)
		const bodyField = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "body",
		)
		expect(bodyField).toBeDefined()
		expect(tpl.groups.find((g) => g.id === "payload")).toBeDefined()
	})

	it("expands body properties when expandBody=true", () => {
		const tpl = buildTemplate(getOp("createNote"), { ...OPTS, expandBody: true })
		const textField = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "body.text",
		)
		const pinnedField = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "body.pinned",
		)
		expect(textField).toBeDefined()
		expect(textField?.constraints?.notEmpty).toBe(true)
		expect(pinnedField?.type).toBe("Boolean")
	})

	it("includes auth block", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const authType = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "authentication.type",
		)
		expect(authType).toBeDefined()
	})

	it("sets defaultAuthType", () => {
		const tpl = buildTemplate(getOp("listItems"), { ...OPTS, defaultAuthType: "bearer" })
		const authType = tpl.properties.find(
			(p) => p.binding.type === "zeebe:input" && p.binding.name === "authentication.type",
		)
		expect(authType?.value).toBe("bearer")
	})

	it("uses template id from idPrefix + operationId", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		expect(tpl.id).toBe("io.test.listitems")
	})

	it("uses operationId summary as display name", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		expect(tpl.name).toBe("List items")
	})

	it("includes output mapping fields", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const resultVar = tpl.properties.find(
			(p) => p.binding.type === "zeebe:taskHeader" && p.binding.key === "resultVariable",
		)
		expect(resultVar).toBeDefined()
	})

	it("includes retry fields", () => {
		const tpl = buildTemplate(getOp("listItems"), OPTS)
		const retries = tpl.properties.find(
			(p) => p.binding.type === "zeebe:taskDefinition" && p.binding.property === "retries",
		)
		expect(retries?.value).toBe("3")
	})
})

// ─── buildTemplates ───────────────────────────────────────────────────────────

describe("buildTemplates", () => {
	it("returns one template per operation", () => {
		const doc = parseOpenApi(MINIMAL_SPEC)
		const ops = getOperations(doc)
		const templates = buildTemplates(ops, OPTS)
		expect(templates).toHaveLength(ops.length)
	})
})
