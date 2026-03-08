fn main() {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let root = std::path::PathBuf::from(&manifest).join("../..").canonicalize().unwrap();

    // Run pnpm bridge build (esbuild bundles bridge.ts → dist/bridge.bundle.js)
    let status = std::process::Command::new("pnpm")
        .args(["--filter", "@bpmn-sdk/ai-server", "run", "bridge"])
        .current_dir(&root)
        .status()
        .expect("failed to spawn pnpm bridge");
    assert!(status.success(), "bridge bundle failed");

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let src = root.join("apps/ai-server/dist/bridge.bundle.js");
    let dst = std::path::PathBuf::from(&out_dir).join("bridge.bundle.js");
    std::fs::copy(&src, &dst).expect("failed to copy bridge.bundle.js to OUT_DIR");

    println!("cargo:rerun-if-changed=../ai-server/src/bridge.ts");
    println!("cargo:rerun-if-changed=../../packages/core/src");
}
