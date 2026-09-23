# Reebe

A BPMN workflow engine in Rust that implements the [Camunda 8](https://camunda.com/) Orchestration
Cluster REST API (`/v2/*`) and the Zeebe gateway gRPC service — for local development, tests and
CI, without a JVM or Elasticsearch.

> **Status: experimental, single-node, for development and testing.** Reebe is a clean-room
> implementation and is not affiliated with Camunda. It is not a production replacement for a
> Camunda 8 cluster: there is no replication, no clustering and no exporter framework, and its
> compatibility is checked by its own test suite rather than against Zeebe.

## What is Reebe?

Reebe implements the Camunda 8 REST API v2 and the Zeebe `gateway_protocol.Gateway` gRPC service,
so a client or SDK that targets a Camunda 8 cluster can usually be pointed at it unchanged.

It stores everything in one SQL database — PostgreSQL, or SQLite embedded in the binary — in
place of Zeebe's RocksDB journal and the Elasticsearch query side. The append-only event-log
model Zeebe uses is kept, implemented in SQL.

## Why Reebe?

| Property | Camunda 8 (self-managed) | Reebe |
|---|---|---|
| Runtime | JVM | Single native binary |
| Storage | RocksDB + Elasticsearch/OpenSearch or RDBMS | PostgreSQL, or embedded SQLite |
| APIs | REST v2 + gRPC | REST v2 + gRPC gateway (port 26500) |
| Clustering | Raft, multi-partition | Single node |
| Licence | Camunda License 1.0 (production needs an Enterprise licence) | Apache-2.0 |

Reebe fits development machines, CI pipelines and demos — anywhere a full Camunda 8 stack is
more than the job needs. `reebe-bench` measures throughput and latency on your own hardware;
no benchmark figures are published yet.

The same engine compiles to WebAssembly as
[`@bpmnkit/reebe-wasm`](https://www.npmjs.com/package/@bpmnkit/reebe-wasm), which
`@bpmnkit/engine/wasm-runner` and `casen test` use to run scenarios in the browser and Node.js.

---

## Quick Start

### Option 1: Embedded SQLite (fastest, no dependencies)

```bash
git clone https://github.com/bpmnkit/monorepo
cd monorepo/apps/reebe
just dev-embedded
```

Starts Reebe with a built-in SQLite database — no Docker or PostgreSQL needed.

### Option 2: Docker Compose (PostgreSQL)

```bash
git clone https://github.com/bpmnkit/monorepo
cd monorepo/apps/reebe
docker-compose up
```

The API is available at `http://localhost:8080/v2/`.

### Option 3: Binary with PostgreSQL

```bash
# Build from source
cargo build --release -p reebe-server

# Start PostgreSQL (or provide your own)
docker run -d --name reebe-pg \
  -e POSTGRES_DB=reebe -e POSTGRES_USER=reebe -e POSTGRES_PASSWORD=reebe \
  -p 5432:5432 postgres:16-alpine

# Run Reebe
REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe \
  ./target/release/reebe-server
```

---

## Requirements

- **PostgreSQL 15+** — required only when using the default backend
- **Rust 1.80+** — required only when building from source
- No external dependencies when using `--features embedded` (SQLite is built in)

---

## Installation

### Docker Compose (easiest)

```bash
docker-compose up
```

This starts PostgreSQL and Reebe together. Data is persisted in a named Docker volume.

### Build from source

```bash
cargo build --release -p reebe-server
# Binary is at ./target/release/reebe
```

### Download binary

There are no pre-built binaries yet; build from source as above, or with
`cargo install --path crates/reebe-server`.

---

## Configuration

Reebe is configured via a TOML file (default: `config.toml`) with environment variable overrides.

### Full config.toml reference

```toml
[server]
# Interface to bind to
host = "0.0.0.0"
# Port for the REST API (Camunda 8 compatible at /v2/*)
port = 8080

[database]
# PostgreSQL connection URL
url = "postgres://reebe:reebe@localhost:5432/reebe"
# Maximum connections in the pool
max_connections = 20
# Minimum connections kept alive
min_connections = 2
# Seconds to wait before failing a connection attempt
connection_timeout_secs = 30

[engine]
# Number of partitions (for future clustering)
partition_count = 1
# Node ID (for future clustering)
node_id = 0
# Maximum records processed per batch
max_batch_size = 100
# How often to check for due timers (milliseconds)
timer_check_interval_ms = 100
# How often to check for timed-out jobs (milliseconds)
job_timeout_check_interval_ms = 1000

[jobs]
# Default long-poll timeout for job activation (milliseconds)
default_poll_timeout_ms = 30000
# Maximum allowed activation timeout (milliseconds)
max_activation_timeout_ms = 600000

[logging]
# Log level: trace, debug, info, warn, error
level = "info"
# Format: "json" or "text"
format = "text"
```

### Environment variable overrides

Configuration keys map to environment variables with the `REEBE_` prefix and `__` as the
section separator:

```
REEBE_DATABASE__URL=postgres://...
REEBE_SERVER__PORT=8080
RUST_LOG=reebe=info
```

See `.env.example` for a full list.

---

## API Compatibility

Reebe implements the Camunda 8 REST API v2. Endpoints are available at:

```
http://localhost:8080/v2/*
```

### API Examples

#### Deploy a process

```bash
curl -X POST http://localhost:8080/v2/deployments \
  -F "resources=@process.bpmn"
```

#### Create a process instance

```bash
curl -X POST http://localhost:8080/v2/process-instances \
  -H "Content-Type: application/json" \
  -d '{
    "bpmnProcessId": "my-process",
    "version": -1,
    "variables": {"orderId": "123"}
  }'
```

#### Activate jobs

```bash
curl -X POST http://localhost:8080/v2/jobs/activation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "my-job-type",
    "maxJobsToActivate": 10,
    "worker": "my-worker",
    "timeout": 60000
  }'
```

#### Complete a job

```bash
curl -X POST http://localhost:8080/v2/jobs/{key}/completion \
  -H "Content-Type: application/json" \
  -d '{"variables": {"result": "ok"}}'
```

#### Publish a message

```bash
curl -X POST http://localhost:8080/v2/messages/publication \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-received",
    "correlationKey": "order-123",
    "variables": {"amount": 99.99}
  }'
```

#### Broadcast a signal

```bash
curl -X POST http://localhost:8080/v2/signals/broadcast \
  -H "Content-Type: application/json" \
  -d '{"signalName": "shutdown", "variables": {}}'
```

#### Search process instances

```bash
curl -X POST http://localhost:8080/v2/process-instances/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"state": "ACTIVE"},
    "page": {"limit": 20}
  }'
```

#### Get topology

```bash
curl http://localhost:8080/v2/topology
```

---

## Architecture

Reebe is a Cargo workspace with the following crates:

| Crate | Description |
|---|---|
| `reebe-protocol` | Shared domain types, record types, intents, and value types |
| `reebe-feel` | FEEL (Friendly Enough Expression Language) evaluator |
| `reebe-bpmn` | BPMN 2.0 XML parser and process model types |
| `reebe-dmn` | DMN decision table parser and evaluator |
| `reebe-db` | PostgreSQL connection pool, migrations, and state repositories |
| `reebe-engine` | Event-sourcing stream processor, command gateway, and scheduler |
| `reebe-api` | Axum HTTP handlers, DTOs, and routing for all `/v2/*` endpoints |
| `reebe-server` | Binary entry point: CLI parsing, configuration, and startup |

### Processing model

Each command (e.g. `CREATE_PROCESS_INSTANCE`) is written to an append-only `partition_records`
table in PostgreSQL. A single-threaded processing loop reads commands in order, runs the
appropriate processor, and writes resulting events plus updated state projections — all in one
database transaction. This is the same event-sourcing model used by Zeebe, re-implemented in
Rust on top of PostgreSQL.

---

## Development

### Running tests

```bash
cargo test --workspace
```

### Running with Docker Compose

```bash
docker-compose up
```

### Running locally

Start PostgreSQL first, then:

```bash
RUST_LOG=info cargo run -p reebe-server
```

Or with a config file:

```bash
RUST_LOG=info cargo run -p reebe-server -- --config config.example.toml
```

### Using the justfile

If you have [just](https://github.com/casey/just) installed:

```bash
just            # list all available commands
```

| Command | Description |
|---|---|
| `just dev` | Run in development mode (PostgreSQL required, verbose logging) |
| `just dev-fresh` | Flush the database and start from scratch (drops + recreates the volume) |
| `just dev-embedded` | Run with built-in SQLite — no external database needed |
| `just build` | Build a release binary |
| `just test` | Run all tests |
| `just test-verbose` | Run tests with stdout/stderr shown |
| `just check` | Check for compilation errors across the workspace |
| `just fmt` | Format all code with `rustfmt` |
| `just lint` | Run `clippy` with `-D warnings` |
| `just db-up` | Start only PostgreSQL via docker-compose |
| `just db-down` | Stop PostgreSQL (keeps the volume) |
| `just up` | Start the full stack (PostgreSQL + server) via docker-compose |
| `just down` | Stop everything and remove the data volume |
| `just bench [--count N] [--concurrency N]` | Run the throughput benchmark against a running server |

#### Embedded mode (no external database)

```bash
just dev-embedded
```

Builds and starts Reebe with a built-in SQLite database stored in the OS application-data
directory (`~/.local/share/reebe/reebe.db` on Linux, `~/Library/Application Support/reebe/reebe.db`
on macOS). No Docker, no PostgreSQL required — suitable for quick experimentation.

#### Benchmark

```bash
# Start the server first, then:
just bench
just bench --count 5000 --concurrency 100
```

Reports PI/s (process instances per second), average latency, and error count.

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `REEBE_DATABASE__URL` | PostgreSQL connection URL | `postgres://zeebe:zeebe@localhost:5432/zeebe` |
| `REEBE_SERVER__PORT` | HTTP port | `8080` |
| `RUST_LOG` | Log filter (see `tracing-subscriber`) | `reebe=info` |

---

## Compatibility Notes

### What works

- Full Camunda 8 REST API v2 JSON schema compatibility
- Process deployment (BPMN 2.0 + Zeebe extensions)
- Process instance creation, cancellation, and search
- Job activation (including long polling), completion, failure, and error
- Message publication and correlation
- Signal broadcasting
- Timer events (boundary, intermediate, start)
- Variables (get, update, search)
- Incidents (search, resolve)
- User tasks
- Topology endpoint
- Multi-tenancy (basic)

### What is not supported

- **gRPC API** — the gateway on port 26500 implements the Zeebe `Gateway` service's
  job, instance, message, signal, variable, incident, decision and deployment calls; the
  REST API is the better-tested surface
- **Elasticsearch / OpenSearch exporters** — no exporter framework yet
- **Camunda web apps** (Operate, Tasklist, Optimize) — not included
- **Multi-node clustering (Raft)** — single-node only in current version

---

## License

Apache 2.0 — see [LICENSE](./LICENSE). The rest of the BPMN Kit monorepo is MIT; Reebe keeps the
Apache-2.0 licence it was first published under.
