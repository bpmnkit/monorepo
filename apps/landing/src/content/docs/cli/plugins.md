---
title: casen Plugins
description: Official casen CLI plugins shipped with the BPMN Kit monorepo.
sidebar:
  order: 6
---

> **Auto-generated** — this page is built from `plugins-cli/*/package.json` during the site
> build. Do not edit it by hand.

Official plugins extend `casen` with domain-specific command groups. Install them with:

```sh
casen plugin install <name>
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [`@bpmnkit/casen-report`](#-bpmnkit-casen-report) | Render HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-ai`](#-bpmnkit-casen-worker-ai) | AI task worker plugin for casen — classify, summarize, extract, and decide using Claude |
| [`@bpmnkit/casen-worker-http`](#-bpmnkit-casen-worker-http) | Example casen worker plugin — processes HTTP connector jobs using the JSONPlaceholder API |

---

## `@bpmnkit/casen-report`

Render HTML reports from Camunda 8 incident and SLA data

### Installation

```sh
casen plugin install @bpmnkit/casen-report
```

| Command | Description |
|---------|-------------|
| `casen report incidents` | Generate an HTML report of current incidents grouped by process |
| `casen report sla` | Generate an SLA compliance report for process instances |

---

## `@bpmnkit/casen-worker-ai`

AI task worker plugin for casen — classify, summarize, extract, and decide using Claude

### Installation

```sh
casen plugin install @bpmnkit/casen-worker-ai
```

| Command | Description |
|---------|-------------|
| `casen ai-worker classify` | Classify text into one of the given categories |
| `casen ai-worker summarize` | Summarize text to a given length and style |
| `casen ai-worker extract` | Extract structured fields from unstructured text |
| `casen ai-worker decide` | Make a boolean decision based on a question, context, and optional policy |

---

## `@bpmnkit/casen-worker-http`

Example casen worker plugin — processes HTTP connector jobs using the JSONPlaceholder API

### Installation

```sh
casen plugin install @bpmnkit/casen-worker-http
```

| Command | Description |
|---------|-------------|
| `casen http-worker start` | Subscribe to HTTP connector jobs and complete them with live API data |

---

## Authoring Plugins

See the [Plugin Authoring](/docs/cli/plugin-authoring) guide to build and publish your own `casen` plugin.
