use bpmn_proxy::access::{is_loopback_host, AccessPolicy};
use bpmn_proxy::ai_server;
use bpmn_proxy::bridge::CoreBridge;
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("AI_SERVER_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3033);

    // Resolve the bpmn-mcp binary path.
    // Prefer BPMN_MCP_PATH env var (set by Tauri from resource dir).
    // Fall back to a sibling binary next to this executable.
    let mcp_bin: PathBuf = if let Ok(p) = std::env::var("BPMN_MCP_PATH") {
        PathBuf::from(p)
    } else {
        std::env::current_exe()
            .unwrap_or_else(|_| PathBuf::from("bpmn-mcp"))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("bpmn-mcp")
    };

    eprintln!("[ai-server] mcp_bin: {}", mcp_bin.display());

    let bridge = CoreBridge::new();
    let state = ai_server::AppState { bridge, mcp_bin };
    let app = ai_server::router(state, AccessPolicy::from_env());

    // Loopback by default: `/chat` starts an AI CLI on this machine.
    let host = std::env::var("BPMNKIT_PROXY_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let addrs: Vec<String> = if is_loopback_host(&host) {
        vec![format!("127.0.0.1:{port}"), format!("[::1]:{port}")]
    } else {
        eprintln!(
            "WARNING: listening on {host}:{port}, not only on loopback. Any machine that can reach \
             it can run AI tools through it. Set BPMNKIT_PROXY_ALLOWED_HOSTS to the name clients use."
        );
        let addr = if host.contains(':') && !host.starts_with('[') {
            format!("[{host}]:{port}")
        } else {
            format!("{host}:{port}")
        };
        vec![addr]
    };

    let mut servers = Vec::new();
    for (i, addr) in addrs.iter().enumerate() {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                let app = app.clone();
                servers.push(tokio::spawn(async move {
                    axum::serve(listener, app).await.expect("server error");
                }));
            }
            // The IPv6 loopback is a convenience; 127.0.0.1 is not.
            Err(e) if i > 0 => eprintln!("[ai-server] not listening on {addr}: {e}"),
            Err(e) => panic!("failed to bind {addr}: {e}"),
        }
    }
    eprintln!("BPMN SDK AI Server running at http://localhost:{port}");
    eprintln!("Press Ctrl+C to stop");
    for server in servers {
        server.await.expect("server task failed");
    }
}
