import { DecisionTableBuilder } from "./dmn-builder.js";
import type { DmnDefinitions } from "./dmn-model.js";
import { parseDmn } from "./dmn-parser.js";
import { serializeDmn } from "./dmn-serializer.js";

/** Entry point for DMN decision table operations. */
export const Dmn = {
	/** Create a new DMN decision table using the fluent builder API. */
	createDecisionTable(decisionId: string): DecisionTableBuilder {
		return new DecisionTableBuilder(decisionId);
	},

	/** Parse a DMN XML string into a typed model. */
	parse(xml: string): DmnDefinitions {
		return parseDmn(xml);
	},

	/** Export a typed DMN model to XML string. */
	export(definitions: DmnDefinitions): string {
		return serializeDmn(definitions);
	},

	/**
	 * Returns a minimal valid DMN definitions object with one empty decision table.
	 * Useful for "New Decision" actions.
	 */
	makeEmpty(): DmnDefinitions {
		const id = Math.random().toString(36).slice(2, 9);
		return parseDmn(`<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_${id}" name="New Decision" namespace="http://bpmn.io/schema/dmn">
  <decision id="Decision_${id}" name="Decision 1">
    <decisionTable id="decisionTable_${id}" hitPolicy="UNIQUE">
      <output id="output_${id}" label="Result" name="result" typeRef="string"/>
    </decisionTable>
  </decision>
</definitions>`);
	},
} as const;
