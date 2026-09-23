fn main() {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let root = std::path::PathBuf::from(&manifest).join("../..").canonicalize().unwrap();

    // Run pnpm bridge build (esbuild bundles bridge.ts → dist/bridge.bundle.js)
    // pnpm is a .cmd shim on Windows, which Command does not resolve on its own.
    let pnpm = if cfg!(windows) { "pnpm.cmd" } else { "pnpm" };
    let status = std::process::Command::new(pnpm)
        .args(["--filter", "@bpmnkit/proxy", "run", "bridge"])
        .current_dir(&root)
        .status()
        .expect("failed to spawn pnpm bridge");
    assert!(status.success(), "bridge bundle failed");

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let src = root.join("apps/proxy/dist/bridge.bundle.js");
    let dst = std::path::PathBuf::from(&out_dir).join("bridge.bundle.js");
    std::fs::copy(&src, &dst).expect("failed to copy bridge.bundle.js to OUT_DIR");

    println!("cargo:rerun-if-changed=../proxy/src/bridge.ts");
    println!("cargo:rerun-if-changed=../../packages/core/src");
}
