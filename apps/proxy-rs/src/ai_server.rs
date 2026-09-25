//! HTTP AI server — axum routes: GET /status, POST /chat.

use std::convert::Infallible;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::extract::State;
use axum::http::{Method, StatusCode};
use axum::response::sse::{Event, Sse};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt as _;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::access::{self, AccessPolicy};
use crate::adapters::{Message, ALL_ADAPTERS};
use crate::bridge::CoreBridge;
use crate::prompt::{self, FindingInfo};

// ── App state ─────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub bridge: CoreBridge,
    /// Absolute path to the bpmn-mcp binary (for MCP config).
    pub mcp_bin: PathBuf,
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState, policy: AccessPolicy) -> Router {
    let origins = policy.clone();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(move |origin, _| {
            origin.to_str().is_ok_and(|o| origins.origin_allowed(o))
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([axum::http::header::CONTENT_TYPE])
        .allow_private_network(true);

    // The guard is the outer layer, so a refused request never reaches CORS or a route.
    Router::new()
        .route("/status", get(handle_status))
        .route("/chat", post(handle_chat))
        .layer(cors)
        .layer(axum::middleware::from_fn(move |req, next| {
            access::guard(policy.clone(), req, next)
        }))
        .with_state(state)
}

// ── GET /status ───────────────────────────────────────────────────────────────

async fn handle_status() -> impl IntoResponse {
    let mut available: Vec<&str> = Vec::new();
    for adapter in ALL_ADAPTERS {
        if adapter.available().await {
            available.push(adapter.name);
        }
    }
    let ready = !available.is_empty();
    let backend = available.first().copied();
    eprintln!("[server] /status → available: [{}]", available.join(", "));
    Json(json!({ "ready": ready, "backend": backend, "available": available }))
}

// ── POST /chat ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ChatRequest {
    messages: Vec<ChatMessage>,
    context: Option<Value>,
    backend: Option<String>,
    action: Option<String>,
}

#[derive(Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

async fn handle_chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> axum::response::Response {
    // Detect available adapters
    let mut available_names: Vec<&'static str> = Vec::new();
    for adapter in ALL_ADAPTERS {
        if adapter.available().await {
            available_names.push(adapter.name);
        }
    }

    let adapter_name: &'static str = if let Some(ref name) = req.backend {
        available_names
            .iter()
            .find(|&&n| n == name.as_str())
            .or_else(|| available_names.first())
            .copied()
            .unwrap_or("")
    } else {
        available_names.first().copied().unwrap_or("")
    };

    if adapter_name.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "No AI CLI available. Install claude, copilot, or gemini.",
        )
            .into_response();
    }

    // supports_mcp = the adapter CAN use MCP AND the bpmn-mcp binary is present
    let adapter_supports_mcp = ALL_ADAPTERS
        .iter()
        .find(|a| a.name == adapter_name)
        .map(|a| a.supports_mcp)
        .unwrap_or(false);
    let supports_mcp = adapter_supports_mcp && state.mcp_bin.exists();

    eprintln!(
        "[server] /chat → adapter: {adapter_name}, action: {}, mcp: {supports_mcp}",
        req.action.as_deref().unwrap_or("chat")
    );
    if adapter_supports_mcp && !supports_mcp {
        eprintln!("[server] bpmn-mcp not found at {:?} — falling back to system prompt mode", state.mcp_bin);
    }

    let current_compact: Option<Value> = req.context.as_ref().and_then(|c| {
        if c.get("processes").is_some() { Some(c.clone()) } else { None }
    });

    // ── Collect findings for improve action ────────────────────────────────────
    let mut findings: Vec<FindingInfo> = Vec::new();
    if req.action.as_deref() == Some("improve") {
        if let Some(ref compact) = current_compact {
            match state.bridge.optimize_findings(compact.to_string()).await {
                Ok(json_str) => {
                    if let Ok(fs) = serde_json::from_str::<Vec<FindingInfo>>(&json_str) {
                        eprintln!("[server] improve → {} findings", fs.len());
                        findings = fs;
                    }
                }
                Err(e) => eprintln!("[server] improve → core analysis failed: {e}"),
            }
        }
    }

    // ── Build system prompt ────────────────────────────────────────────────────
    let system_prompt = if supports_mcp {
        if req.action.as_deref() == Some("improve") {
            prompt::build_mcp_improve_prompt(&findings)
        } else {
            prompt::build_mcp_system_prompt()
        }
    } else {
        prompt::build_system_prompt(req.context.as_ref())
    };

    // ── Set up MCP temp files ──────────────────────────────────────────────────
    let mut tmp_dir: Option<PathBuf> = None;
    let mut mcp_config_file: Option<String> = None;
    let mut output_file: Option<String> = None;

    // Only use MCP if the bpmn-mcp binary actually exists (cargo run --bin ai-server
    // only links ai-server; bpmn-mcp must be built separately or via cargo build).
    if supports_mcp && state.mcp_bin.exists() {
        let tmp = std::env::temp_dir().join(format!("bpmn-mcp-{}", uuid_simple()));
        if fs::create_dir_all(&tmp).is_ok() {
            let out_path = tmp.join("output.bpmn");
            let mcp_path = tmp.join("mcp.json");

            // Only write --input if a diagram context was provided (mirrors original TS behavior)
            let mut mcp_args: Vec<serde_json::Value> = Vec::new();
            if let Some(ref compact) = current_compact {
                if let Ok(xml) = state.bridge.expand_and_export(compact.to_string()).await {
                    let input_path = tmp.join("input.bpmn");
                    if fs::write(&input_path, xml).is_ok() {
                        mcp_args.push(json!("--input"));
                        mcp_args.push(json!(input_path.to_string_lossy().as_ref()));
                    }
                }
            }
            mcp_args.push(json!("--output"));
            mcp_args.push(json!(out_path.to_string_lossy().as_ref()));

            let mcp_config = json!({
                "mcpServers": {
                    "bpmn": {
                        "type": "stdio",
                        "command": state.mcp_bin.to_string_lossy(),
                        "args": mcp_args
                    }
                }
            });
            if fs::write(&mcp_path, mcp_config.to_string()).is_ok() {
                mcp_config_file = Some(mcp_path.to_string_lossy().into_owned());
                output_file = Some(out_path.to_string_lossy().into_owned());
            }
            tmp_dir = Some(tmp);
        }
    }

    // ── SSE streaming ─────────────────────────────────────────────────────────
    let (sse_tx, sse_rx) = mpsc::unbounded_channel::<Value>();
    let accumulated = Arc::new(Mutex::new(String::new()));

    let messages: Vec<Message> = req
        .messages
        .into_iter()
        .map(|m| Message { role: m.role, content: m.content })
        .collect();
    let bridge = state.bridge.clone();

    tokio::spawn(async move {
        let send = |v: Value| { let _ = sse_tx.send(v); };

        // Each match arm gets its own clone of sse_tx + accumulated to avoid move issues
        let stream_result = match adapter_name {
            "claude" => {
                let acc = accumulated.clone();
                let tx = sse_tx.clone();
                crate::adapters::stream_claude(
                    &messages,
                    &system_prompt,
                    mcp_config_file.as_deref(),
                    move |text: String| {
                        acc.lock().unwrap().push_str(&text);
                        let _ = tx.send(json!({ "type": "token", "text": text }));
                    },
                )
                .await
            }
            "copilot" => {
                let acc = accumulated.clone();
                let tx = sse_tx.clone();
                crate::adapters::stream_copilot(
                    &messages,
                    &system_prompt,
                    mcp_config_file.as_deref(),
                    move |text: String| {
                        acc.lock().unwrap().push_str(&text);
                        let _ = tx.send(json!({ "type": "token", "text": text }));
                    },
                )
                .await
            }
            _ => {
                let acc = accumulated.clone();
                let tx = sse_tx.clone();
                crate::adapters::stream_gemini(
                    &messages,
                    &system_prompt,
                    move |text: String| {
                        acc.lock().unwrap().push_str(&text);
                        let _ = tx.send(json!({ "type": "token", "text": text }));
                    },
                )
                .await
            }
        };

        if let Err(e) = stream_result {
            let msg = e.to_string();
            eprintln!("[server] adapter error: {msg}");
            send(json!({ "type": "error", "message": msg }));
        }

        // ── Post-process: emit XML ─────────────────────────────────────────────
        if let Some(ref out_path) = output_file {
            match fs::read_to_string(out_path) {
                Ok(xml) => {
                    send(json!({ "type": "xml", "xml": xml }));
                    eprintln!("[server] MCP XML output read successfully");
                }
                Err(_) => eprintln!("[server] MCP output file not written (no diagram changes)"),
            }
        } else {
            let acc_str = accumulated.lock().unwrap().clone();
            if let Some(compact_json) = extract_compact_diagram(&acc_str) {
                match bridge.expand_and_export(compact_json).await {
                    Ok(xml) => {
                        send(json!({ "type": "xml", "xml": xml }));
                        eprintln!("[server] XML emitted via core expand + export");
                    }
                    Err(e) => eprintln!("[server] failed to expand result: {e}"),
                }
            }
        }

        if let Some(ref dir) = tmp_dir {
            let _ = fs::remove_dir_all(dir);
        }

        send(json!({ "type": "done" }));
    });

    let event_stream = UnboundedReceiverStream::new(sse_rx)
        .map(|v: Value| -> Result<Event, Infallible> {
            Ok(Event::default().data(v.to_string()))
        });

    Sse::new(event_stream).into_response()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_compact_diagram(text: &str) -> Option<String> {
    let start_marker = "```json\n";
    let end_marker = "\n```";
    let start = text.find(start_marker)? + start_marker.len();
    let rest = &text[start..];
    let end = rest.find(end_marker)?;
    let json_str = &rest[..end];
    let parsed: Value = serde_json::from_str(json_str).ok()?;
    if parsed.get("processes").and_then(|p| p.as_array()).is_some() {
        Some(json_str.to_string())
    } else {
        None
    }
}

/// Simple unique ID using system time + PID (no uuid dep needed).
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{}-{}", t, std::process::id())
}
