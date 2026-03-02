use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_ai_server(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

/// Spawns the bundled AI server as a background Node.js process.
/// Silently skipped if Node.js is not on PATH or the bundle is not present
/// (e.g. during `tauri dev` without a prior bundle step).
fn spawn_ai_server(app: &tauri::App) {
    let Ok(resource_dir) = app.path().resource_dir() else {
        return;
    };
    let server_path = resource_dir.join("ai-server.cjs");
    if server_path.exists() {
        let _ = std::process::Command::new("node")
            .arg(&server_path)
            .spawn();
    }
}
