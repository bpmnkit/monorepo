# casen CLI — Worker commands

```sh
# Run a simple auto-complete worker (for testing)
casen worker payment-service

# Start scaffolded workers from ./workers/
casen worker start

# Start a specific scaffolded worker
casen worker start send-invoice
```


## Local engine (Reebe)

Reebe is a **dev/test** workflow engine (~50 MB) that serves the Zeebe API locally, so you
can deploy and run processes on your machine or in CI without a Camunda 8 cluster. It is
[Experimental](/docs/getting-started/stability#product-tiers) and single-node: do not run it
in production. Reebe is a clean-room implementation written from Camunda's public
documentation, and is not affiliated with or endorsed by Camunda. "Zeebe" and "Camunda" are
trademarks of Camunda Services GmbH.

```sh
# Embedded SQLite, no external database
casen reebe start

# Custom port — match ZEEBE_ADDRESS, which defaults to http://localhost:26500
casen reebe start --port 26500

# PostgreSQL instead of the embedded database
casen reebe start --database-url postgres://user:pass@localhost/reebe
```

| Flag | Default | Description |
|---|---|---|
| `--port` | `8080` | HTTP port to listen on |
| `--database-url` | embedded SQLite | PostgreSQL connection URL |
| `--config` | `config.toml` | Path to the engine config file |

`casen reebe` on its own is shorthand for `casen reebe start`. The command runs the
`reebe-server` binary; build it with
`cargo install --path apps/reebe/crates/reebe-server` if it is not on your `PATH`.

---
Source: https://bpmnkit.com/docs/cli/casen
