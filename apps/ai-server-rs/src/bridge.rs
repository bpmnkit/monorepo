//! CoreBridge — wraps the QuickJS runtime containing the compiled bridge.bundle.js.
//!
//! QuickJS is single-threaded and `!Send`, so all JS calls run on a dedicated OS thread.
//! The HTTP server (tokio multi-thread) sends commands via `std::sync::mpsc`.
//! The MCP server (single-thread) uses the sync helper methods directly.

use std::sync::mpsc;
use tokio::sync::oneshot;

static BRIDGE_JS: &str = include_str!(concat!(env!("OUT_DIR"), "/bridge.bundle.js"));

// ── Command enum ───────────────────────────────────────────────────────────────

type Reply<T> = oneshot::Sender<anyhow::Result<T>>;

enum BridgeCmd {
    ExpandAndExport {
        compact_json: String,
        reply: Reply<String>,
    },
    OptimizeFindings {
        compact_json: String,
        reply: Reply<String>,
    },
    McpInit {
        xml: Option<String>,
        reply: Reply<()>,
    },
    McpGetDiagram {
        reply: Reply<String>,
    },
    McpExportXml {
        reply: Reply<String>,
    },
    McpAddElements {
        process_id: String,
        elements_json: String,
        flows_json: String,
        reply: Reply<String>,
    },
    McpRemoveElements {
        process_id: String,
        element_ids_json: String,
        flow_ids_json: String,
        reply: Reply<String>,
    },
    McpUpdateElement {
        process_id: String,
        element_id: String,
        changes_json: String,
        reply: Reply<String>,
    },
    McpSetCondition {
        process_id: String,
        flow_id: String,
        condition_json: String,
        reply: Reply<String>,
    },
    McpReplaceDiagram {
        compact_json: String,
        reply: Reply<String>,
    },
    McpAddHttpCall {
        process_id: String,
        config_json: String,
        reply: Reply<String>,
    },
    McpExecuteCode {
        code: String,
        reply: Reply<String>,
    },
}

// ── JS evaluation helpers ──────────────────────────────────────────────────────

/// Evaluate a JS expression that returns a string.
fn js_call_str(ctx: &rquickjs::Ctx<'_>, expr: &str) -> anyhow::Result<String> {
    ctx.eval::<String, _>(expr).map_err(|e| anyhow::anyhow!("{e}"))
}

/// Set a JS global to a parsed JSON object (avoids injection: value is JSON-encoded first).
fn js_set_json(ctx: &rquickjs::Ctx<'_>, name: &str, json_value: &str) -> anyhow::Result<()> {
    // json_value is already a JSON string; JSON.parse it directly in JS.
    // We embed it as a JS string literal via serde_json quoting so special chars are escaped.
    let quoted = serde_json::to_string(json_value).map_err(|e| anyhow::anyhow!("{e}"))?;
    ctx.eval::<(), _>(format!("globalThis.{name}=JSON.parse({quoted});"))
        .map_err(|e| anyhow::anyhow!("js_set_json {name}: {e}"))
}

/// Set a JS global to undefined (for optional args).
fn js_set_undefined(ctx: &rquickjs::Ctx<'_>, name: &str) -> anyhow::Result<()> {
    ctx.eval::<(), _>(format!("globalThis.{name}=undefined;"))
        .map_err(|e| anyhow::anyhow!("js_set_undefined {name}: {e}"))
}

fn js_set_opt_xml(ctx: &rquickjs::Ctx<'_>, name: &str, value: &Option<String>) -> anyhow::Result<()> {
    match value {
        Some(xml) => {
            // XML is not JSON — pass as a JS string literal using JSON quoting.
            let quoted = serde_json::to_string(xml).map_err(|e| anyhow::anyhow!("{e}"))?;
            ctx.eval::<(), _>(format!("globalThis.{name}={quoted};"))
                .map_err(|e| anyhow::anyhow!("js_set_opt_xml {name}: {e}"))
        }
        None => js_set_undefined(ctx, name),
    }
}

fn dispatch(ctx: &rquickjs::Ctx<'_>, cmd: BridgeCmd) {
    match cmd {
        BridgeCmd::ExpandAndExport { compact_json, reply } => {
            // compact_json is a JSON string → set as JS object, stringify back for bridge fn
            let result = js_set_json(ctx, "__a", &compact_json)
                .and_then(|_| js_call_str(ctx, "Bridge.expandAndExport(JSON.stringify(__a))"));
            let _ = reply.send(result);
        }

        BridgeCmd::OptimizeFindings { compact_json, reply } => {
            let result = js_set_json(ctx, "__a", &compact_json)
                .and_then(|_| js_call_str(ctx, "Bridge.optimizeFindings(JSON.stringify(__a))"));
            let _ = reply.send(result);
        }

        BridgeCmd::McpInit { xml, reply } => {
            // xml is a raw XML string (not JSON) — or undefined
            let result = js_set_opt_xml(ctx, "__a", &xml).and_then(|_| {
                ctx.eval::<(), _>("Bridge.mcpInit(__a);")
                    .map_err(|e| anyhow::anyhow!("mcpInit: {e}"))
            });
            let _ = reply.send(result);
        }

        BridgeCmd::McpGetDiagram { reply } => {
            let _ = reply.send(js_call_str(ctx, "Bridge.mcpGetDiagram()"));
        }

        BridgeCmd::McpExportXml { reply } => {
            let _ = reply.send(js_call_str(ctx, "Bridge.mcpExportXml()"));
        }

        BridgeCmd::McpAddElements { process_id, elements_json, flows_json, reply } => {
            // process_id is a plain string; elements/flows are JSON arrays
            let result = js_set_opt_xml(ctx, "__a", &Some(process_id))
                .and_then(|_| js_set_json(ctx, "__b", &elements_json))
                .and_then(|_| js_set_json(ctx, "__c", &flows_json))
                .and_then(|_| {
                    js_call_str(ctx, "Bridge.mcpAddElements(__a, JSON.stringify(__b), JSON.stringify(__c))")
                });
            let _ = reply.send(result);
        }

        BridgeCmd::McpRemoveElements { process_id, element_ids_json, flow_ids_json, reply } => {
            let result = js_set_opt_xml(ctx, "__a", &Some(process_id))
                .and_then(|_| js_set_json(ctx, "__b", &element_ids_json))
                .and_then(|_| js_set_json(ctx, "__c", &flow_ids_json))
                .and_then(|_| {
                    js_call_str(ctx, "Bridge.mcpRemoveElements(__a, JSON.stringify(__b), JSON.stringify(__c))")
                });
            let _ = reply.send(result);
        }

        BridgeCmd::McpUpdateElement { process_id, element_id, changes_json, reply } => {
            let result = js_set_opt_xml(ctx, "__a", &Some(process_id))
                .and_then(|_| js_set_opt_xml(ctx, "__b", &Some(element_id)))
                .and_then(|_| js_set_json(ctx, "__c", &changes_json))
                .and_then(|_| {
                    js_call_str(ctx, "Bridge.mcpUpdateElement(__a, __b, JSON.stringify(__c))")
                });
            let _ = reply.send(result);
        }

        BridgeCmd::McpSetCondition { process_id, flow_id, condition_json, reply } => {
            // condition_json is either a JSON string ("\"expr\"") or "null"
            let result = js_set_opt_xml(ctx, "__a", &Some(process_id))
                .and_then(|_| js_set_opt_xml(ctx, "__b", &Some(flow_id)))
                .and_then(|_| js_set_json(ctx, "__c", &condition_json))
                .and_then(|_| {
                    js_call_str(ctx, "Bridge.mcpSetCondition(__a, __b, JSON.stringify(__c))")
                });
            let _ = reply.send(result);
        }

        BridgeCmd::McpReplaceDiagram { compact_json, reply } => {
            let result = js_set_json(ctx, "__a", &compact_json)
                .and_then(|_| js_call_str(ctx, "Bridge.mcpReplaceDiagram(JSON.stringify(__a))"));
            let _ = reply.send(result);
        }

        BridgeCmd::McpAddHttpCall { process_id, config_json, reply } => {
            let result = js_set_opt_xml(ctx, "__a", &Some(process_id))
                .and_then(|_| js_set_json(ctx, "__b", &config_json))
                .and_then(|_| {
                    js_call_str(ctx, "Bridge.mcpAddHttpCall(__a, JSON.stringify(__b))")
                });
            let _ = reply.send(result);
        }

        BridgeCmd::McpExecuteCode { code, reply } => {
            // Pass the code as a JSON-quoted string to Bridge.mcpExecuteCode().
            // Bridge.mcpExecuteCode evals it inside the QuickJS closure, giving the LLM
            // access to Bridge.*, __state, Bpmn, expand, compactify, etc.
            let quoted = serde_json::to_string(&code).unwrap_or_default();
            let result = js_call_str(ctx, &format!("Bridge.mcpExecuteCode({quoted})"));
            let _ = reply.send(result);
        }
    }
}

// ── CoreBridge (async API for HTTP server) ─────────────────────────────────────

#[derive(Clone)]
pub struct CoreBridge {
    tx: mpsc::SyncSender<BridgeCmd>,
}

impl CoreBridge {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::sync_channel::<BridgeCmd>(64);
        std::thread::spawn(move || {
            let rt = rquickjs::Runtime::new().expect("QuickJS runtime init failed");
            let ctx = rquickjs::Context::full(&rt).expect("QuickJS context init failed");
            ctx.with(|ctx| {
                ctx.eval::<(), _>(BRIDGE_JS).expect("bridge.bundle.js eval failed");
            });
            while let Ok(cmd) = rx.recv() {
                ctx.with(|ctx| dispatch(&ctx, cmd));
            }
        });
        CoreBridge { tx }
    }

    // ── async methods (used by HTTP server) ───────────────────────────────────

    async fn send<T>(&self, make_cmd: impl FnOnce(Reply<T>) -> BridgeCmd) -> anyhow::Result<T> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(make_cmd(tx))
            .map_err(|_| anyhow::anyhow!("bridge thread disconnected"))?;
        rx.await.map_err(|_| anyhow::anyhow!("bridge reply channel closed"))?
    }

    pub async fn expand_and_export(&self, compact_json: String) -> anyhow::Result<String> {
        self.send(|reply| BridgeCmd::ExpandAndExport { compact_json, reply }).await
    }

    pub async fn optimize_findings(&self, compact_json: String) -> anyhow::Result<String> {
        self.send(|reply| BridgeCmd::OptimizeFindings { compact_json, reply }).await
    }

    // ── sync methods (used by MCP server on its own thread) ───────────────────

    fn send_sync<T>(&self, make_cmd: impl FnOnce(Reply<T>) -> BridgeCmd) -> anyhow::Result<T> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(make_cmd(tx))
            .map_err(|_| anyhow::anyhow!("bridge thread disconnected"))?;
        rx.blocking_recv()
            .map_err(|_| anyhow::anyhow!("bridge reply channel closed"))?
    }

    pub fn mcp_init_sync(&self, xml: Option<String>) -> anyhow::Result<()> {
        self.send_sync(|reply| BridgeCmd::McpInit { xml, reply })
    }

    pub fn mcp_get_diagram_sync(&self) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpGetDiagram { reply })
    }

    pub fn mcp_export_xml_sync(&self) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpExportXml { reply })
    }

    pub fn mcp_add_elements_sync(
        &self,
        process_id: String,
        elements_json: String,
        flows_json: String,
    ) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpAddElements {
            process_id,
            elements_json,
            flows_json,
            reply,
        })
    }

    pub fn mcp_remove_elements_sync(
        &self,
        process_id: String,
        element_ids_json: String,
        flow_ids_json: String,
    ) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpRemoveElements {
            process_id,
            element_ids_json,
            flow_ids_json,
            reply,
        })
    }

    pub fn mcp_update_element_sync(
        &self,
        process_id: String,
        element_id: String,
        changes_json: String,
    ) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpUpdateElement {
            process_id,
            element_id,
            changes_json,
            reply,
        })
    }

    pub fn mcp_set_condition_sync(
        &self,
        process_id: String,
        flow_id: String,
        condition_json: String,
    ) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpSetCondition {
            process_id,
            flow_id,
            condition_json,
            reply,
        })
    }

    pub fn mcp_replace_diagram_sync(&self, compact_json: String) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpReplaceDiagram { compact_json, reply })
    }

    pub fn mcp_add_http_call_sync(
        &self,
        process_id: String,
        config_json: String,
    ) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpAddHttpCall { process_id, config_json, reply })
    }

    pub fn mcp_execute_code_sync(&self, code: String) -> anyhow::Result<String> {
        self.send_sync(|reply| BridgeCmd::McpExecuteCode { code, reply })
    }
}
