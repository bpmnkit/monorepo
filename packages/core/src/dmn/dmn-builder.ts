import { generateId } from "../types/id-generator.js";
import type {
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnDiagram,
	DmnInput,
	DmnInputEntry,
	DmnOutput,
	DmnOutputEntry,
	DmnRule,
	DmnTypeRef,
	HitPolicy,
} from "./dmn-model.js";
import { serializeDmn } from "./dmn-serializer.js";

const DMN_MODEL_NS = "https://www.omg.org/spec/DMN/20191111/MODEL/";
const DMN_DI_NS = "https://www.omg.org/spec/DMN/20191111/DMNDI/";
const DC_NS = "http://www.omg.org/spec/DMN/20180521/DC/";
const MODELER_NS = "http://camunda.org/schema/modeler/1.0";
const DEFAULT_NAMESPACE = "http://camunda.org/schema/1.0/dmn";

/** Options for creating a decision table input column. */
export interface InputOptions {
	/** Display label for the input column. */
	label?: string;
	/** FEEL expression for the input (e.g., variable name). */
	expression: string;
	/** Data type of the input. */
	typeRef?: DmnTypeRef;
}

/** Options for creating a decision table output column. */
export interface OutputOptions {
	/** Display label for the output column. */
	label?: string;
	/** Variable name for the output. */
	name: string;
	/** Data type of the output. */
	typeRef?: DmnTypeRef;
}

/** Options for creating a decision table rule (row). */
export interface RuleOptions {
	/** Human-readable description/annotation for this rule. */
	description?: string;
	/** Input entry values (unary tests), one per input column. */
	inputs: string[];
	/** Output entry values (literal expressions), one per output column. */
	outputs: string[];
}

/** Fluent builder for constructing DMN decision tables. */
export class DecisionTableBuilder {
	private readonly decisionId: string;
	private decisionName: string;
	private tableId: string;
	private hitPolicyValue: HitPolicy = "UNIQUE";
	private readonly inputColumns: DmnInput[] = [];
	private readonly outputColumns: DmnOutput[] = [];
	private readonly ruleRows: DmnRule[] = [];

	constructor(decisionId: string) {
		this.decisionId = decisionId;
		this.decisionName = decisionId;
		this.tableId = generateId("DecisionTable");
	}

	/** Set the display name for this decision. */
	name(name: string): this {
		this.decisionName = name;
		return this;
	}

	/** Set the hit policy for this decision table. */
	hitPolicy(policy: HitPolicy): this {
		this.hitPolicyValue = policy;
		return this;
	}

	/** Add an input column to the decision table. */
	input(options: InputOptions): this {
		const inputId = generateId("Input");
		const exprId = generateId("InputExpression");

		this.inputColumns.push({
			id: inputId,
			label: options.label,
			inputExpression: {
				id: exprId,
				typeRef: options.typeRef,
				text: options.expression,
			},
		});

		return this;
	}

	/** Add an output column to the decision table. */
	output(options: OutputOptions): this {
		const outputId = generateId("Output");

		this.outputColumns.push({
			id: outputId,
			label: options.label,
			name: options.name,
			typeRef: options.typeRef,
		});

		return this;
	}

	/** Add a rule (row) to the decision table. */
	rule(options: RuleOptions): this {
		if (options.inputs.length !== this.inputColumns.length) {
			throw new Error(
				`Rule has ${options.inputs.length} inputs but table has ${this.inputColumns.length} input columns`,
			);
		}
		if (options.outputs.length !== this.outputColumns.length) {
			throw new Error(
				`Rule has ${options.outputs.length} outputs but table has ${this.outputColumns.length} output columns`,
			);
		}

		const inputEntries: DmnInputEntry[] = options.inputs.map((text) => ({
			id: generateId("UnaryTests"),
			text,
		}));

		const outputEntries: DmnOutputEntry[] = options.outputs.map((text) => ({
			id: generateId("LiteralExpression"),
			text,
		}));

		this.ruleRows.push({
			id: generateId("DecisionRule"),
			description: options.description,
			inputEntries,
			outputEntries,
		});

		return this;
	}

	/** Build the DMN definitions model. */
	build(): DmnDefinitions {
		const decisionTable: DmnDecisionTable = {
			id: this.tableId,
			hitPolicy: this.hitPolicyValue === "UNIQUE" ? undefined : this.hitPolicyValue,
			inputs: this.inputColumns,
			outputs: this.outputColumns,
			rules: this.ruleRows,
		};

		const decision: DmnDecision = {
			id: this.decisionId,
			name: this.decisionName,
			decisionTable,
			informationRequirements: [],
			knowledgeRequirements: [],
			authorityRequirements: [],
		};

		const diagram: DmnDiagram = {
			shapes: [
				{
					dmnElementRef: this.decisionId,
					bounds: { x: 160, y: 100, width: 180, height: 80 },
				},
			],
			edges: [],
		};

		return {
			id: generateId("Definitions"),
			name: "DRD",
			namespace: DEFAULT_NAMESPACE,
			exporter: "bpmn-sdk",
			exporterVersion: "0.0.1",
			namespaces: {
				"": DMN_MODEL_NS,
				dmndi: DMN_DI_NS,
				dc: DC_NS,
				modeler: MODELER_NS,
			},
			modelerAttributes: {
				executionPlatform: "Camunda Cloud",
				executionPlatformVersion: "8.5.0",
			},
			decisions: [decision],
			inputData: [],
			knowledgeSources: [],
			businessKnowledgeModels: [],
			textAnnotations: [],
			associations: [],
			diagram,
		};
	}

	/** Build and export as DMN XML string. */
	toXml(): string {
		return serializeDmn(this.build());
	}
}
