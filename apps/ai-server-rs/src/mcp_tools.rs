//! MCP tool definitions and dispatch (ported from mcp-server.ts).

use serde_json::{Value, json};
use crate::bridge::CoreBridge;

// ── Tool schema definitions ────────────────────────────────────────────────────

pub fn tool_list() -> Value {
    let element_schema = json!({
        "type": "object",
        "properties": {
            "id": { "type": "string", "description": "Unique element ID" },
            "type": {
                "type": "string",
                "description": "BPMN element type. Events: startEvent | endEvent | intermediateThrowEvent | intermediateCatchEvent | boundaryEvent. Tasks: serviceTask | userTask | businessRuleTask | callActivity | scriptTask | sendTask | manualTask. Gateways: exclusiveGateway | parallelGateway | inclusiveGateway | eventBasedGateway. Containers: subProcess | adHocSubProcess."
            },
            "name": { "type": "string", "description": "Display name shown on the diagram" },
            "eventType": { "type": "string", "description": "For events: timer | message | signal | error | escalation | cancel | terminate | conditional | link | compensate" },
            "attachedTo": { "type": "string", "description": "boundaryEvent only: ID of the host activity" },
            "interrupting": { "type": "boolean", "description": "boundaryEvent only: false = non-interrupting (default true)" },
            "jobType": { "type": "string", "description": "serviceTask only: Zeebe worker job type. For HTTP/REST API calls do NOT set this here — use the add_http_call tool instead." },
            "formId": { "type": "string", "description": "userTask only: linked Camunda form ID" },
            "calledProcess": { "type": "string", "description": "callActivity only: ID of the called process" },
            "decisionId": { "type": "string", "description": "businessRuleTask only: DMN decision ID" },
            "resultVariable": { "type": "string", "description": "businessRuleTask / serviceTask: process variable to store the task output" }
        },
        "required": ["id", "type"]
    });

    let flow_schema = json!({
        "type": "object",
        "properties": {
            "id": { "type": "string" },
            "from": { "type": "string", "description": "Source element ID" },
            "to": { "type": "string", "description": "Target element ID" },
            "name": { "type": "string" },
            "condition": { "type": "string", "description": "FEEL condition expression" }
        },
        "required": ["id", "from", "to"]
    });

    json!({
        "tools": [
            {
                "name": "get_diagram",
                "description": "Return the current BPMN diagram. Call this first before making any changes.",
                "inputSchema": { "type": "object", "properties": {} }
            },
            {
                "name": "execute_code",
                "description": "Execute JavaScript to make complex multi-step diagram changes in a single call.\nPrefer this over multiple separate tool calls when building a process from scratch,\ndoing batch edits, or applying conditional logic.\n\nBridge API (all JSON args are strings — use JSON.stringify/JSON.parse):\n  Bridge.mcpGetDiagram() → CompactDiagram JSON string\n  Bridge.mcpAddElements(processId, elementsJson, flowsJson) → result string\n  Bridge.mcpRemoveElements(processId, elementIdsJson, flowIdsJson) → result string\n  Bridge.mcpUpdateElement(processId, elementId, changesJson) → result string\n  Bridge.mcpSetCondition(processId, flowId, conditionJson) → result string\n  Bridge.mcpReplaceDiagram(compactJson) → result string\n  Bridge.mcpAddHttpCall(processId, configJson) → result string\n    configJson fields: {id, name, method, url, headers?, body?, resultVariable?}\n  Bridge.mcpExportXml() → BPMN XML string\n\nUse `return` to return the final result string.\nExample: const d=JSON.parse(Bridge.mcpGetDiagram()); Bridge.mcpAddElements(d.processes[0].id, JSON.stringify([{id:'t1',type:'serviceTask',name:'Do Work'}]), JSON.stringify([{id:'f1',from:'start',to:'t1'}])); return 'done';",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "code": { "type": "string", "description": "JavaScript code to execute against the Bridge API" }
                    },
                    "required": ["code"]
                }
            },
            {
                "name": "add_http_call",
                "description": "⚠️ ALWAYS use this tool — not add_elements — for any HTTP/REST API call, webhook, or external service integration.\nAdds a Camunda HTTP connector service task (jobType: io.camunda:http-json:1) with the correct zeebe:ioMapping inputs.\nUse your knowledge of the target API to provide a real endpoint URL, not a placeholder.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "processId": { "type": "string" },
                        "id": { "type": "string", "description": "Unique element ID" },
                        "name": { "type": "string", "description": "Task display name" },
                        "url": { "type": "string", "description": "Full API endpoint URL. Use your knowledge — e.g. https://api.github.com/repos/{owner}/{repo}/issues for GitHub." },
                        "method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"] },
                        "headers": { "type": "string", "description": "Optional JSON string of HTTP headers" },
                        "body": { "type": "string", "description": "Optional FEEL expression for the request body (POST/PUT/PATCH)" },
                        "resultVariable": { "type": "string", "description": "Optional process variable name to store the HTTP response" }
                    },
                    "required": ["processId", "id", "name", "url", "method"]
                }
            },
            {
                "name": "add_elements",
                "description": "Add BPMN elements (tasks, events, gateways) and/or sequence flows to a process.\n⚠️ NOT for HTTP/REST API calls — use add_http_call for those.\nCreates the process if it does not exist.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "processId": { "type": "string", "description": "Target process ID" },
                        "elements": { "type": "array", "items": element_schema, "description": "BPMN elements to add" },
                        "flows": { "type": "array", "items": flow_schema, "description": "Sequence flows to add" }
                    },
                    "required": ["processId"]
                }
            },
            {
                "name": "remove_elements",
                "description": "Remove BPMN elements and/or sequence flows. Removing an element also removes its connecting flows.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "processId": { "type": "string" },
                        "elementIds": { "type": "array", "items": { "type": "string" } },
                        "flowIds": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["processId"]
                }
            },
            {
                "name": "update_element",
                "description": "Rename an existing BPMN element or change its display name.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "processId": { "type": "string" },
                        "elementId": { "type": "string" },
                        "changes": {
                            "type": "object",
                            "properties": { "name": { "type": "string", "description": "New display name" } },
                            "description": "Fields to update — only name is supported; use remove + add for structural changes"
                        }
                    },
                    "required": ["processId", "elementId", "changes"]
                }
            },
            {
                "name": "set_condition",
                "description": "Set or clear a FEEL condition expression on a sequence flow.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "processId": { "type": "string" },
                        "flowId": { "type": "string" },
                        "condition": { "description": "FEEL expression string, or null to remove the condition" }
                    },
                    "required": ["processId", "flowId", "condition"]
                }
            },
            {
                "name": "replace_diagram",
                "description": "Replace the entire diagram. Use only when creating a new diagram from scratch or doing a full structural rewrite.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "diagram": {
                            "type": "object",
                            "description": "Complete diagram object: { id, processes: [{ id, name?, elements: [...], flows: [...] }] }"
                        }
                    },
                    "required": ["diagram"]
                }
            }
        ]
    })
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

pub fn call_tool(
    bridge: &CoreBridge,
    name: &str,
    args: &Value,
    output_path: Option<&str>,
) -> Value {
    eprintln!("[mcp] tool: {name} args: {args}");

    let result = match name {
        "get_diagram" => bridge.mcp_get_diagram_sync(),

        "add_elements" => {
            let process_id = args["processId"].as_str().unwrap_or("").to_string();
            let elements = args.get("elements").cloned().unwrap_or(json!([]));
            let flows = args.get("flows").cloned().unwrap_or(json!([]));
            let r = bridge.mcp_add_elements_sync(
                process_id,
                elements.to_string(),
                flows.to_string(),
            );
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "remove_elements" => {
            let process_id = args["processId"].as_str().unwrap_or("").to_string();
            let element_ids = args.get("elementIds").cloned().unwrap_or(json!([]));
            let flow_ids = args.get("flowIds").cloned().unwrap_or(json!([]));
            let r = bridge.mcp_remove_elements_sync(
                process_id,
                element_ids.to_string(),
                flow_ids.to_string(),
            );
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "update_element" => {
            let process_id = args["processId"].as_str().unwrap_or("").to_string();
            let element_id = args["elementId"].as_str().unwrap_or("").to_string();
            let changes = args.get("changes").cloned().unwrap_or(json!({}));
            let r = bridge.mcp_update_element_sync(
                process_id,
                element_id,
                changes.to_string(),
            );
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "set_condition" => {
            let process_id = args["processId"].as_str().unwrap_or("").to_string();
            let flow_id = args["flowId"].as_str().unwrap_or("").to_string();
            let condition_json = args.get("condition").map(|v| v.to_string()).unwrap_or("null".to_string());
            let r = bridge.mcp_set_condition_sync(process_id, flow_id, condition_json);
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "add_http_call" => {
            let process_id = args["processId"].as_str().unwrap_or("").to_string();
            // Build config object without processId
            let config = json!({
                "id": args.get("id").cloned().unwrap_or(json!("")),
                "name": args.get("name").cloned().unwrap_or(json!("")),
                "method": args.get("method").cloned().unwrap_or(json!("GET")),
                "url": args.get("url").cloned().unwrap_or(json!("")),
                "headers": args.get("headers").cloned(),
                "body": args.get("body").cloned(),
                "resultVariable": args.get("resultVariable").cloned()
            });
            let r = bridge.mcp_add_http_call_sync(process_id, config.to_string());
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "replace_diagram" => {
            let diagram = args.get("diagram").cloned().unwrap_or(json!({}));
            let r = bridge.mcp_replace_diagram_sync(diagram.to_string());
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        "execute_code" => {
            let code = args["code"].as_str().unwrap_or("").to_string();
            let r = bridge.mcp_execute_code_sync(code);
            if r.is_ok() {
                save_state(bridge, output_path);
            }
            r
        }

        _ => Err(anyhow::anyhow!("Unknown tool: {name}")),
    };

    match result {
        Ok(text) => json!({ "content": [{ "type": "text", "text": text }], "isError": false }),
        Err(e) => json!({ "content": [{ "type": "text", "text": e.to_string() }], "isError": true }),
    }
}

fn save_state(bridge: &CoreBridge, output_path: Option<&str>) {
    let Some(path) = output_path else { return };
    match bridge.mcp_export_xml_sync() {
        Ok(xml) => {
            if let Err(e) = std::fs::write(path, xml) {
                eprintln!("[mcp] failed to write output file: {e}");
            }
        }
        Err(e) => eprintln!("[mcp] mcp_export_xml failed: {e}"),
    }
}
