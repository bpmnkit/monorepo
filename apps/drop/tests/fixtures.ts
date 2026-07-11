export { SAMPLE_BPMN_XML } from "@bpmnkit/core"

export const SAMPLE_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_test" name="Pricing" namespace="http://bpmn.io/schema/dmn">
  <decision id="Decision_price" name="Determine Price">
    <decisionTable id="table_1" hitPolicy="UNIQUE">
      <input id="in_1" label="Category">
        <inputExpression id="ie_1" typeRef="string"><text>category</text></inputExpression>
      </input>
      <output id="out_1" label="Price" name="price" typeRef="number"/>
    </decisionTable>
  </decision>
</definitions>`

export const SAMPLE_FORM_JSON = JSON.stringify({
	components: [
		{ type: "textfield", key: "name", label: "Name", id: "Field_1" },
		{ type: "checkbox", key: "agree", label: "Agree", id: "Field_2" },
	],
	type: "default",
	id: "Form_registration",
	executionPlatform: "Camunda Cloud",
	executionPlatformVersion: "8.5.0",
	schemaVersion: 16,
})
