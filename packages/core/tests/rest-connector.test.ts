import { beforeEach, describe, expect, it } from "vitest";
import type { BpmnProcess } from "../src/bpmn/bpmn-model.js";
import { Bpmn, resetIdCounter } from "../src/index.js";
import type { XmlElement } from "../src/types/xml-element.js";

function findExtension(extensions: XmlElement[], name: string): XmlElement | undefined {
	return extensions.find((e) => e.name === name);
}

function findInput(ioMapping: XmlElement, target: string): XmlElement | undefined {
	return ioMapping.children.find((c) => c.name === "zeebe:input" && c.attributes.target === target);
}

function findHeader(taskHeaders: XmlElement, key: string): XmlElement | undefined {
	return taskHeaders.children.find((c) => c.name === "zeebe:header" && c.attributes.key === key);
}

function defined<T>(value: T | undefined, message?: string): T {
	expect(value, message).toBeDefined();
	return value as T;
}

/** Extract the first process from build() result. */
function buildProcess(builder: ReturnType<typeof Bpmn.createProcess>): BpmnProcess {
	const defs = builder.build();
	return defined(defs.processes[0], "Expected at least one process");
}

describe("REST connector builder", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("creates a minimal GET request with default values", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent("start")
				.restConnector("fetch", {
					method: "GET",
					url: "https://api.example.com/data",
				})
				.endEvent("end"),
		);

		expect(process.flowElements).toHaveLength(3);
		const task = defined(process.flowElements[1]);
		expect(task.type).toBe("serviceTask");

		const taskDef = defined(findExtension(task.extensionElements, "zeebe:taskDefinition"));
		expect(taskDef.attributes.type).toBe("io.camunda:http-json:1");
		expect(taskDef.attributes.retries).toBe("3");

		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		const authType = defined(findInput(ioMapping, "authentication.type"));
		expect(authType.attributes.source).toBe("noAuth");

		expect(findInput(ioMapping, "method")?.attributes.source).toBe("GET");
		expect(findInput(ioMapping, "url")?.attributes.source).toBe("https://api.example.com/data");

		expect(findInput(ioMapping, "connectionTimeoutInSeconds")?.attributes.source).toBe("20");
		expect(findInput(ioMapping, "readTimeoutInSeconds")?.attributes.source).toBe("20");

		expect(findInput(ioMapping, "authentication.token")).toBeUndefined();
		expect(findExtension(task.extensionElements, "zeebe:taskHeaders")).toBeUndefined();
	});

	it("creates a POST request with bearer auth and body", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("post-task", {
					method: "POST",
					url: "https://api.example.com/items",
					authentication: { type: "bearer", token: "{{secrets.API_TOKEN}}" },
					body: '={"name": itemName}',
					resultVariable: "createResponse",
					retryBackoff: "PT0S",
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "authentication.type")?.attributes.source).toBe("bearer");
		expect(findInput(ioMapping, "authentication.token")?.attributes.source).toBe(
			"{{secrets.API_TOKEN}}",
		);
		expect(findInput(ioMapping, "method")?.attributes.source).toBe("POST");
		expect(findInput(ioMapping, "body")?.attributes.source).toBe('={"name": itemName}');

		const taskHeaders = defined(findExtension(task.extensionElements, "zeebe:taskHeaders"));
		expect(findHeader(taskHeaders, "resultVariable")?.attributes.value).toBe("createResponse");
		expect(findHeader(taskHeaders, "retryBackoff")?.attributes.value).toBe("PT0S");
	});

	it("creates a GET request with query parameters as FEEL expression", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("fetch-pages", {
					method: "GET",
					url: "https://api.example.com/items",
					authentication: { type: "bearer", token: "{{secrets.TOKEN}}" },
					queryParameters: "={per_page: 100, page: currentPage}",
					resultExpression: "={totalCount: count(response.body)}",
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "queryParameters")?.attributes.source).toBe(
			"={per_page: 100, page: currentPage}",
		);

		const taskHeaders = defined(findExtension(task.extensionElements, "zeebe:taskHeaders"));
		expect(findHeader(taskHeaders, "resultExpression")?.attributes.value).toBe(
			"={totalCount: count(response.body)}",
		);
	});

	it("creates a request with query parameters as Record", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("search", {
					method: "GET",
					url: "https://api.example.com/search",
					queryParameters: { q: "test", limit: "10" },
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "queryParameters")?.attributes.source).toBe(
			'={"q":"test", "limit":"10"}',
		);
	});

	it("creates a request with custom HTTP headers", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("github-api", {
					method: "GET",
					url: "https://api.github.com/repos",
					headers: {
						"Content-Type": "application/vnd.github+json",
						"X-GitHub-Api-Version": "2022-11-28",
					},
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "headers")?.attributes.source).toBe(
			'={"Content-Type":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}',
		);
	});

	it("creates a request with string headers", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("api-call", {
					method: "POST",
					url: "https://api.example.com",
					headers:
						'={"Content-Type":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}',
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "headers")?.attributes.source).toBe(
			'={"Content-Type":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}',
		);
	});

	it("supports PATCH method", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("patch-issue", {
					method: "PATCH",
					url: '="https://api.github.com/issues/" + issueId',
					body: '={state: "closed"}',
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "method")?.attributes.source).toBe("PATCH");
		expect(findInput(ioMapping, "body")?.attributes.source).toBe('={state: "closed"}');
	});

	it("supports custom timeout values", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("slow-api", {
					method: "GET",
					url: "https://slow-api.example.com",
					connectionTimeoutInSeconds: 60,
					readTimeoutInSeconds: 120,
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "connectionTimeoutInSeconds")?.attributes.source).toBe("60");
		expect(findInput(ioMapping, "readTimeoutInSeconds")?.attributes.source).toBe("120");
	});

	it("supports custom retries", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("retry-task", {
					method: "GET",
					url: "https://api.example.com",
					retries: "5",
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const taskDef = defined(findExtension(task.extensionElements, "zeebe:taskDefinition"));
		expect(taskDef.attributes.retries).toBe("5");
	});

	it("generates resultVariable and resultExpression together", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("combined", {
					method: "GET",
					url: "https://api.example.com",
					resultVariable: "rawResponse",
					resultExpression: "={data: response.body}",
					retryBackoff: "PT5S",
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const taskHeaders = defined(findExtension(task.extensionElements, "zeebe:taskHeaders"));

		expect(taskHeaders.children).toHaveLength(3);
		expect(findHeader(taskHeaders, "resultVariable")?.attributes.value).toBe("rawResponse");
		expect(findHeader(taskHeaders, "resultExpression")?.attributes.value).toBe(
			"={data: response.body}",
		);
		expect(findHeader(taskHeaders, "retryBackoff")?.attributes.value).toBe("PT5S");
	});

	it("chains correctly in a process flow", () => {
		const process = buildProcess(
			Bpmn.createProcess("multi-rest")
				.startEvent("start")
				.restConnector("step1", {
					method: "GET",
					url: "https://api.example.com/step1",
					resultVariable: "step1Result",
				})
				.restConnector("step2", {
					method: "POST",
					url: "https://api.example.com/step2",
					body: "=step1Result",
					resultVariable: "step2Result",
				})
				.endEvent("end"),
		);

		expect(process.flowElements).toHaveLength(4);
		expect(process.sequenceFlows).toHaveLength(3);

		expect(process.sequenceFlows[0]?.sourceRef).toBe("start");
		expect(process.sequenceFlows[0]?.targetRef).toBe("step1");
		expect(process.sequenceFlows[1]?.sourceRef).toBe("step1");
		expect(process.sequenceFlows[1]?.targetRef).toBe("step2");
		expect(process.sequenceFlows[2]?.sourceRef).toBe("step2");
		expect(process.sequenceFlows[2]?.targetRef).toBe("end");
	});

	it("produces equivalent output to manual serviceTask construction", () => {
		resetIdCounter();
		const restDefs = Bpmn.createProcess("rest-test")
			.startEvent("s")
			.restConnector("task", {
				method: "GET",
				url: "https://api.example.com",
				authentication: { type: "bearer", token: "{{secrets.TOKEN}}" },
				resultVariable: "result",
				retryBackoff: "PT0S",
			})
			.endEvent("e")
			.build();
		const restProcess = defined(restDefs.processes[0]);

		resetIdCounter();
		const manualDefs = Bpmn.createProcess("manual-test")
			.startEvent("s")
			.serviceTask("task", {
				taskType: "io.camunda:http-json:1",
				retries: "3",
				ioMapping: {
					inputs: [
						{ source: "bearer", target: "authentication.type" },
						{ source: "{{secrets.TOKEN}}", target: "authentication.token" },
						{ source: "GET", target: "method" },
						{ source: "https://api.example.com", target: "url" },
						{ source: "20", target: "connectionTimeoutInSeconds" },
						{ source: "20", target: "readTimeoutInSeconds" },
					],
				},
				taskHeaders: {
					resultVariable: "result",
					retryBackoff: "PT0S",
				},
			})
			.endEvent("e")
			.build();
		const manualProcess = defined(manualDefs.processes[0]);

		const restTask = defined(restProcess.flowElements[1]);
		const manualTask = defined(manualProcess.flowElements[1]);

		const restTaskDef = defined(findExtension(restTask.extensionElements, "zeebe:taskDefinition"));
		const manualTaskDef = defined(
			findExtension(manualTask.extensionElements, "zeebe:taskDefinition"),
		);
		expect(restTaskDef.attributes).toEqual(manualTaskDef.attributes);

		const restIo = defined(findExtension(restTask.extensionElements, "zeebe:ioMapping"));
		const manualIo = defined(findExtension(manualTask.extensionElements, "zeebe:ioMapping"));

		const restInputTargets = restIo.children
			.filter((c) => c.name === "zeebe:input")
			.map((c) => c.attributes.target);
		const manualInputTargets = manualIo.children
			.filter((c) => c.name === "zeebe:input")
			.map((c) => c.attributes.target);
		expect(restInputTargets).toEqual(manualInputTargets);

		const restHeaders = defined(findExtension(restTask.extensionElements, "zeebe:taskHeaders"));
		const manualHeaders = defined(findExtension(manualTask.extensionElements, "zeebe:taskHeaders"));
		expect(restHeaders.children.length).toBe(manualHeaders.children.length);
	});

	it("throws on duplicate element IDs", () => {
		expect(() =>
			Bpmn.createProcess("test")
				.startEvent("dup")
				.restConnector("dup", { method: "GET", url: "http://x.com" }),
		).toThrow('Duplicate element ID "dup"');
	});

	it("omits body, headers, queryParameters when not specified", () => {
		const process = buildProcess(
			Bpmn.createProcess("test")
				.startEvent()
				.restConnector("minimal", {
					method: "GET",
					url: "https://example.com",
				})
				.endEvent(),
		);

		const task = defined(process.flowElements[1]);
		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));

		expect(findInput(ioMapping, "body")).toBeUndefined();
		expect(findInput(ioMapping, "headers")).toBeUndefined();
		expect(findInput(ioMapping, "queryParameters")).toBeUndefined();
	});

	it("supports PUT and DELETE methods", () => {
		for (const method of ["PUT", "DELETE"] as const) {
			resetIdCounter();
			const process = buildProcess(
				Bpmn.createProcess("test")
					.startEvent()
					.restConnector("task", { method, url: "https://example.com" })
					.endEvent(),
			);

			const task = defined(process.flowElements[1]);
			const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));
			expect(findInput(ioMapping, "method")?.attributes.source).toBe(method);
		}
	});

	it("matches real-world pattern: GitHub API with query params", () => {
		const process = buildProcess(
			Bpmn.createProcess("github-workflow")
				.startEvent("start")
				.restConnector("fetch-data", {
					method: "GET",
					url: '="https://api.github.com/repos/" + repoName + "/collaborators"',
					authentication: { type: "bearer", token: "{{secrets.PDP_GITHUB_PAT}}" },
					queryParameters: "={per_page: 100, page: collCurrentPage}",
					connectionTimeoutInSeconds: 20,
					readTimeoutInSeconds: 20,
					resultVariable: "githubCollaboratorsResponse",
					resultExpression: "={currentRepoCollaboratorsCount: count(response.body)}",
					retryBackoff: "PT0S",
				})
				.endEvent("end"),
		);

		const task = defined(process.flowElements[1]);
		expect(task.type).toBe("serviceTask");

		const taskDef = defined(findExtension(task.extensionElements, "zeebe:taskDefinition"));
		expect(taskDef.attributes.type).toBe("io.camunda:http-json:1");
		expect(taskDef.attributes.retries).toBe("3");

		const ioMapping = defined(findExtension(task.extensionElements, "zeebe:ioMapping"));
		expect(findInput(ioMapping, "authentication.type")?.attributes.source).toBe("bearer");
		expect(findInput(ioMapping, "authentication.token")?.attributes.source).toBe(
			"{{secrets.PDP_GITHUB_PAT}}",
		);
		expect(findInput(ioMapping, "method")?.attributes.source).toBe("GET");
		expect(findInput(ioMapping, "url")?.attributes.source).toBe(
			'="https://api.github.com/repos/" + repoName + "/collaborators"',
		);
		expect(findInput(ioMapping, "queryParameters")?.attributes.source).toBe(
			"={per_page: 100, page: collCurrentPage}",
		);

		const taskHeaders = defined(findExtension(task.extensionElements, "zeebe:taskHeaders"));
		expect(findHeader(taskHeaders, "resultVariable")?.attributes.value).toBe(
			"githubCollaboratorsResponse",
		);
		expect(findHeader(taskHeaders, "resultExpression")?.attributes.value).toBe(
			"={currentRepoCollaboratorsCount: count(response.body)}",
		);
		expect(findHeader(taskHeaders, "retryBackoff")?.attributes.value).toBe("PT0S");
	});
});
