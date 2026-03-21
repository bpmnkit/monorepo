<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/casen-worker-ai</h1>
  <p>AI task worker plugin for casen — classify, summarize, extract, and decide using Claude</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-worker-ai?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai)
  [![license](https://img.shields.io/npm/l/@bpmnkit/casen-worker-ai?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/plugins-cli/casen-worker-ai/CHANGELOG.md)
</div>

---

## Overview

`casen-worker-ai` is an official `casen` CLI plugin that brings AI-powered task processing into Camunda 8 workflows. It subscribes to four job types and uses the [Anthropic Claude API](https://anthropic.com) to complete each job with structured output.

This is the right tool when you need AI logic in a process but don't want to build a full microservice — start the worker once and any process in your cluster can delegate AI tasks to it.

## Why a worker instead of the HTTP connector?

The built-in Camunda HTTP connector can call any API but cannot:
- Validate or parse the response and fail the job if the output is malformed
- Route Anthropic rate-limit errors (429) to Camunda's retry budget with back-off
- Throw a typed BPMN error that an error boundary event can catch

The worker handles all three via `failJob` and `throwJobError`, giving your process model clean error paths.

## Installation

```sh
casen plugin install casen-worker-ai
```

Set your Anthropic API key before starting:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
casen ai-worker
```

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **required** | Your Anthropic API key |
| `AI_MODEL` | `claude-3-5-haiku-20241022` | Model ID to use |
| `AI_MAX_TOKENS` | `1024` | Token budget per call |
| `AI_TIMEOUT_MS` | `60000` | HTTP timeout in ms |

## Operations

### `com.bpmnkit.ai.classify` — Classify text

Classifies text into one of the provided categories.

**Input variables:**

| Variable | Type | Required | Description |
|---|---|---|---|
| `input` | string | ✓ | Text to classify |
| `categories` | string[] | ✓ | Allowed category names |
| `context` | string | — | Optional domain context |

**Output variables:** `category`, `confidence` (0–1), `rationale`, `aiModel`, `processedAt`

**BPMN error codes:** `AI_INVALID_CATEGORY`, `AI_PARSE_ERROR`, `AI_API_ERROR`, `AI_INVALID_INPUT`

```xml
<bpmn:serviceTask id="ClassifyTicket" name="Classify ticket">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="com.bpmnkit.ai.classify" retries="3" />
    <zeebe:taskHeaders>
      <zeebe:header key="retryBackoff" value="PT30S" />
    </zeebe:taskHeaders>
    <zeebe:ioMapping>
      <zeebe:input source="=ticket.body" target="input" />
      <zeebe:input source='=["billing","technical","cancellation","general"]' target="categories" />
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

### `com.bpmnkit.ai.summarize` — Summarize text

Summarizes text to a target length and style.

**Input variables:**

| Variable | Type | Required | Description |
|---|---|---|---|
| `input` | string | ✓ | Text to summarize |
| `maxWords` | number | — | Target word count (default: 100) |
| `style` | `"bullet"` | `"paragraph"` | — | Output style (default: `"paragraph"`) |

**Output variables:** `summary`, `wordCount`, `aiModel`, `processedAt`

### `com.bpmnkit.ai.extract` — Extract structured fields

Extracts named fields from unstructured text. Missing fields are reported but the job still completes — use a gateway on `=missingFields` to decide whether to auto-proceed or route to manual review.

**Input variables:**

| Variable | Type | Required | Description |
|---|---|---|---|
| `input` | string | ✓ | Unstructured text |
| `fields` | string[] | ✓ | Field names to extract |
| `schema` | object | — | Type hints per field, e.g. `{ amount: "number" }` |

**Output variables:** `extracted` (object), `missingFields` (array), `aiModel`, `processedAt`

### `com.bpmnkit.ai.decide` — Make a boolean decision

Answers a yes/no question based on context and an optional policy statement. Use `confidence` at a gateway to route low-confidence decisions to human review.

**Input variables:**

| Variable | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✓ | The yes/no question |
| `context` | string | ✓ | Relevant facts |
| `policy` | string | — | Natural language policy the model must apply |

**Output variables:** `decision` (boolean), `rationale`, `confidence` (0–1), `aiModel`, `processedAt`

## Example workflow: Credit decision

```
Start Event
  → summarize (summarize application notes, maxWords=150)
  → decide     (question="Approve loan?", policy="Score ≥ 680 and amount ≤ 50k")
  → Gateway: decision=true and confidence≥0.8 → Auto-approve
             decision=false and confidence≥0.8 → Auto-deny
             default                           → Human review
```

## Error handling

Add boundary events to your service tasks to handle AI failures gracefully:

- **Error boundary** catching `AI_PARSE_ERROR` → route to a manual input fallback task
- **Timer boundary** (PT5M) → escalation path if the worker is not running
- Set `retries="3"` and `retryBackoff="PT30S"` on the task definition — the worker signals Camunda to retry via `failJob` on rate limits and network timeouts

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
