# Reebe

A **dev/test** BPMN workflow engine in Rust that implements the [Camunda 8](https://camunda.com/)
Orchestration Cluster REST API (`/v2/*`) and the Zeebe gateway gRPC service — for local
development, tests and CI, without a JVM or Elasticsearch. **Do not run it in production.**

> **Tier: Experimental — single-node, for development and testing only.** It may change or be
> discontinued; see [product tiers](https://bpmnkit.com/docs/getting-started/stability#product-tiers).
> Reebe is a clean-room implementation of the Zeebe API, written from Camunda's public
> documentation. It is not affiliated with or endorsed by Camunda. It is not a replacement for a
> Camunda 8 cluster: there is no replication, no clustering and no exporter framework, and its
> compatibility is checked by its own test suite rather than against Zeebe.
>
> "Zeebe" and "Camunda" are trademarks of Camunda Services GmbH, used here only to name the API
> that Reebe implements.

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
more than the job needs. For anything in production, use Camunda 8. `reebe-bench` measures throughput and latency on your own hardware;
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
appropriate processor, and writes resulting events plus updated state projections. This is the
same event-sourcing model used by Zeebe, re-implemented in Rust on top of PostgreSQL.

After each command, the engine stores its position in `processed_positions`. When the server
restarts against an existing database, each partition resumes after the last processed command:
commands appended but not processed yet run once, and nothing is replayed. (Before, every
restart re-processed the whole log and duplicated jobs, timers and instances.) A command that
was being processed when the server stopped abruptly is processed again.

---

## Development

### Running tests

```bash
cargo test --workspace
```

The Postgres suites (`crates/reebe-engine/tests/integration.rs` and `compatibility.rs`) skip
themselves unless `REEBE_DATABASE__URL` is set. To run them, start a throwaway PostgreSQL and
point the tests at it:

```bash
docker run -d --rm --name reebe-test-pg -p 5432:5432 \
  -e POSTGRES_USER=reebe -e POSTGRES_PASSWORD=reebe -e POSTGRES_DB=reebe postgres:16-alpine
REEBE_DATABASE__URL=postgres://reebe:reebe@localhost:5432/reebe REEBE_REQUIRE_DB=1 \
  cargo test --workspace
```

- Each test creates its own database (`reebe_test_*`) on that server: tests run in parallel,
  and an engine processes every unprocessed command on its partition, so tests sharing a
  database would process each other's commands. The user in the URL needs the `CREATEDB`
  privilege. The databases are not dropped afterwards, so do not point the tests at a server
  you care about.
- `REEBE_REQUIRE_DB=1` makes the tests fail, not skip, when the URL is missing or the database
  cannot be reached. CI (`.github/workflows/reebe.yml`) sets it.
- The throughput benchmark is `#[ignore]`d, with the reason in the attribute. Run it with
  `cargo test --workspace -- --ignored`.
- There is no SQLite test suite. CI only checks that the embedded build compiles
  (`cargo check -p reebe-server --no-default-features --features embedded`).
- `test_timer_accuracy` runs the engine and scheduler on a virtual clock: it asserts that a
  timer does not fire 1 ms before its due date and fires within 2 s (one 100 ms scheduler poll
  plus slack for slow runners) once it is due.

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
- Timer events: intermediate catch, boundary and start events. Deploying a process schedules
  its timer start events (`timeDate` once; `timeCycle` as `R/…`, `Rn/…` or a Spring-style cron
  expression such as `0 0 9-17 * * MON-FRI`), each firing creates an instance, and a new
  version cancels the previous version's timers
- Message start events: a published message whose name matches creates an instance with the
  message variables; with a correlation key, at most one instance started by that key is
  active at a time, and a new version closes the previous version's subscriptions
- Scope completion as in Zeebe: an embedded sub-process or a process instance completes only
  when nothing inside it is active any more; a terminate end event terminates the rest of its
  own flow scope and completes that scope
- Timer, message and signal boundary events, interrupting and non-interrupting: armed when
  the activity starts and cancelled when it ends; a timer cycle repeats
- Event-based gateways: the first event wins and the others are cancelled
- Event sub-processes of every start event type. Timer (duration, date or cycle, evaluated
  with FEEL against the scope), message (correlation key evaluated against the scope) and
  signal start events are armed when their flow scope (the process or an embedded
  sub-process) activates and disarmed when it completes or is terminated. An interrupting
  one terminates everything else in the scope, triggers once and disarms the others; a
  non-interrupting one runs alongside as often as it triggers (a timer cycle repeats). The
  message or signal variables propagate as a catch event's do, so the event sub-process sees
  them. Error and escalation event sub-processes catch throws. An event sub-process instance
  has the element type `EVENT_SUB_PROCESS`
- Error variables: the variables a job worker throws an error with go to the error boundary
  event or error event sub-process that catches it, and propagate as a catch event's do
  (an output mapping on a boundary event picks what leaves)
- Exclusive gateways take the first flow whose condition holds, else the default flow. With
  no match and no default flow they raise a `CONDITION_ERROR` incident and stay activating;
  resolving the incident evaluates the gateway again. Default flows are recognised in
  sub-processes and event sub-processes at every depth. Parallel gateways take every
  outgoing flow and ignore conditions on them, as Zeebe does
- Inclusive gateways: the split takes every flow whose condition holds, else the default
  flow, else raises a `CONDITION_ERROR` incident that, like the exclusive gateway's, retries
  the split when resolved; the join activates once every incoming flow has a token or can
  no longer be reached in its flow scope (see below)
- Complex gateways fail deployment with `Elements of type 'complexGateway' are currently not
  supported`, as in Zeebe, which does not execute them
- Link events: a link throw event continues at the link catch event of the same name in its
  scope (the process or a sub-process). Deployment fails for a throw event without a catch
  event of its name, for two catch events with the same name in one scope, and for an empty
  link name
- Compensation: when an activity with a compensation boundary event completes, it is
  recorded with its handler (the `isForCompensation` activity an association links to the
  boundary event); a multi-instance activity is recorded once, when all its instances have
  completed, and an activity that completes twice is recorded twice. A compensation
  intermediate throw or end event starts, all at once, the handlers of the activities that
  completed in its scope and in the completed sub-processes inside it, most recently
  completed first, and waits until they have all completed. Active and terminated
  activities and sub-processes are not compensated, and each completion is compensated
  once. `activityRef` limits it to that activity of the throw event's scope. A throw event in
  an event sub-process (for example the compensation end event of an error event
  sub-process) compensates the scope around the event sub-process. A handler starts with a
  copy of the compensated activity's local variables and sees the variables of its scope;
  its result propagates like any task's. Deployment fails for an `activityRef` that is not
  an activity with a compensation boundary event in the throw event's scope, and for a
  compensation start event in an event sub-process, which Zeebe does not support
- Ad-hoc sub-processes. Each activation of an inner element runs in its own
  `AD_HOC_SUB_PROCESS_INNER_INSTANCE`, which keeps what its elements write; the element's
  outgoing sequence flows are followed inside it. Run by Zeebe, `activeElementsCollection`
  lists the elements to activate (an empty list, or none, activates nothing and the
  sub-process waits; an id that is not an element without incoming flows raises an
  incident), `completionCondition` is checked each time an activation completes, and
  `cancelRemainingInstances` (default `true`) terminates the rest when it holds; without a
  condition, the sub-process completes when every activated element has. With a job worker
  implementation (the AI Agent Sub-process), the job's `adHocSubProcess` result activates
  elements (`activateElements`, each with variables for its activation), fulfils the
  completion condition (`isCompletionConditionFulfilled`) and cancels or waits for the
  remaining activations (`isCancelRemainingInstances`); the job is created again whenever an
  activation completes, one job at a time. A job completed without activating elements or
  fulfilling the condition completes the sub-process. An invalid result (activating and
  fulfilling at once, or an element that cannot be activated) rejects the completion.
  `outputElement` is collected into `outputCollection`, which is propagated when the
  sub-process completes
- Resolving an incident raised while an element was activating (an I/O mapping, a gateway
  condition, a multi-instance input collection, an ad-hoc `activeElementsCollection`) retries
  that same element instance
- Joins wait per flow scope and incoming sequence flow: a parallel join needs a token on each
  incoming flow, and a token waiting at a join keeps its flow scope active, as in Zeebe, even
  if the join can never activate
- Multi-instance (parallel and sequential) on every task type, sub-process and call
  activity, with `inputElement`, `outputCollection`/`outputElement` and `completionCondition`
- Variables (get, update, search)
- Incidents (search, resolve)
- User tasks
- Topology endpoint
- Multi-tenancy (basic)

#### When an inclusive join activates

A flow of the join can still be reached if a path of sequence flows leads to it from an
element instance active in the join's flow scope, from an element a token is on its way to,
or from another join of the scope with a waiting token. Boundary events of the elements on a
path count as paths, and a path follows a link throw event to its link catch event; a path
does not lead through the join itself, so a flow that has a token is not waited for again.
The join is evaluated when a token reaches it and whenever an element of its flow scope
completes. The analysis is static and per flow scope: it does not evaluate conditions (a flow
whose condition can never hold still counts as reachable).

### Known gaps

- A condition that fails to evaluate (an error, or a value that is not a boolean) counts as
  false; Zeebe raises an incident
- Ad-hoc sub-processes: the `adHocSubProcessElements` variable is not created, the REST
  endpoint that activates ad-hoc sub-process activities is not implemented, and the gRPC
  `CompleteJob` call has no job result (the REST job completion passes `result` on)
- Compensation: a handler whose activity's sub-process has completed runs in the throw event's
  scope; where Zeebe places it has not been checked against Zeebe. A handler's completion is
  what the throw event waits for, so a handler that is terminated leaves it waiting until
  its scope ends

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
