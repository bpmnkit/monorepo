import { Bpmn, resetIdCounter } from "@bpmn-sdk/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
	CAMUNDA_CONNECTOR_TEMPLATES,
	templateToServiceTaskOptions,
} from "../../src/config-panel-bpmn/index.js";

function findExtension(
	extensions: Array<{ name: string; attributes: Record<string, string>; children: unknown[] }>,
	name: string,
) {
	return extensions.find((e) => e.name === name);
}

function findInput(
	ioMapping: { children: Array<{ name: string; attributes: Record<string, string> }> },
	target: string,
) {
	return ioMapping.children.find((c) => c.name === "zeebe:input" && c.attributes.target === target);
}

describe("templateToServiceTaskOptions", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("converts the Kafka connector template into valid ServiceTaskOptions", () => {
		const kafka = CAMUNDA_CONNECTOR_TEMPLATES.find(
			(t) => t.id === "io.camunda.connectors.KAFKA.v1",
		);
		if (!kafka) throw new Error("Kafka connector template not found in generated list");

		const options = templateToServiceTaskOptions(kafka, {
			"topic.bootstrapServers": "localhost:9092",
			"topic.topicName": "orders",
			"message.value": "= order",
		});

		expect(options.taskType).toBe("io.camunda:connector-kafka:1");
		expect(options.modelerTemplate).toBe("io.camunda.connectors.KAFKA.v1");
		expect(options.ioMapping?.inputs).toEqual(
			expect.arrayContaining([
				{ source: "localhost:9092", target: "topic.bootstrapServers" },
				{ source: "orders", target: "topic.topicName" },
				{ source: "= order", target: "message.value" },
			]),
		);
	});

	it("builds valid BPMN using the Bpmn builder with a Kafka connector template", () => {
		const kafka = CAMUNDA_CONNECTOR_TEMPLATES.find(
			(t) => t.id === "io.camunda.connectors.KAFKA.v1",
		);
		if (!kafka) throw new Error("Kafka connector template not found in generated list");

		const defs = Bpmn.createProcess("proc")
			.startEvent("start")
			.serviceTask(
				"publish",
				templateToServiceTaskOptions(kafka, {
					"topic.bootstrapServers": "localhost:9092",
					"topic.topicName": "orders",
					"message.value": "= order",
				}),
			)
			.endEvent("end")
			.build();

		const task = defs.processes[0]?.flowElements[1];
		if (!task) throw new Error("task not found");
		expect(task.type).toBe("serviceTask");
		expect(task.unknownAttributes?.["zeebe:modelerTemplate"]).toBe(
			"io.camunda.connectors.KAFKA.v1",
		);

		const taskDef = findExtension(task.extensionElements, "zeebe:taskDefinition");
		expect(taskDef?.attributes.type).toBe("io.camunda:connector-kafka:1");

		const ioMapping = findExtension(task.extensionElements, "zeebe:ioMapping");
		if (!ioMapping) throw new Error("ioMapping not found");
		expect(
			findInput(ioMapping as Parameters<typeof findInput>[0], "topic.bootstrapServers")?.attributes
				.source,
		).toBe("localhost:9092");
		expect(
			findInput(ioMapping as Parameters<typeof findInput>[0], "topic.topicName")?.attributes.source,
		).toBe("orders");
	});

	it("uses template defaults for unspecified optional fields", () => {
		const rest = CAMUNDA_CONNECTOR_TEMPLATES.find(
			(t) => t.id === "io.camunda.connectors.HttpJson.v2",
		);
		if (!rest) throw new Error("REST connector template not found");

		// Only provide required fields; connection timeout should use template default
		const options = templateToServiceTaskOptions(rest, {
			method: "GET",
			url: "https://api.example.com",
		});

		expect(options.taskType).toBe("io.camunda:http-json:1");
		expect(options.modelerTemplate).toBe("io.camunda.connectors.HttpJson.v2");
		// connectionTimeoutInSeconds has a default value in the template
		const timeoutInput = options.ioMapping?.inputs?.find(
			(i) => i.target === "connectionTimeoutInSeconds",
		);
		expect(timeoutInput).toBeDefined();
	});
});
