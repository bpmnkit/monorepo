---
title: "Generating BPMN from natural language with an LLM"
description: "Why raw BPMN XML is the wrong interface for an LLM, and how @bpmnkit/core's compact format lets a model describe a whole process in a single prompt."
pubDate: 2026-06-29
author: "BPMN Kit"
tags: ["ai", "llm", "core"]
---

Asking an LLM to write BPMN 2.0 XML directly rarely goes well — a three-node process is
already ~60 lines of namespaced, cross-referenced XML, and a single wrong element ID or
missing sequence flow reference produces a diagram that silently fails to import. The
fix isn't a smarter prompt, it's a smaller interface: a compact intermediate format the
model can reason about, converted to real BPMN deterministically.

## The compact format

`@bpmnkit/core`'s `compactify`/`expand` pair converts between full BPMN definitions and
a small JSON object — small enough that a typical approval workflow fits in roughly 500
tokens, versus thousands for the equivalent XML:

```typescript
import { Bpmn, compactify, expand } from "@bpmnkit/core";

// Parse existing BPMN XML
const definitions = Bpmn.parse(existingXml);

// Convert to the compact format for the LLM
const compact = compactify(definitions);

// Send it to your LLM along with an instruction
const modified = await llm.modify(compact, "Add a parallel notification step after approval");

// Convert the model's response back to real BPMN
const updatedXml = Bpmn.export(expand(modified));
```

The model never touches raw XML — it reads and writes a small, flat JSON structure, and
`expand()` is what actually produces valid, well-formed BPMN from it.

## Starting from nothing

For a from-scratch generation, `Bpmn.makeEmpty()` gives the model a minimal, valid
starting point — a single start event — rather than an empty string it has to build a
whole document around:

```typescript
const xml = Bpmn.makeEmpty("my-process", "My Process");
// a valid BPMN 2.0 XML string, ready for an agent to extend
```

## Prompting

The instructions that matter most are structural, not creative — the model needs to
know the compact schema's rules (camelCase IDs, every service task needs a `taskType`,
gateway conditions are FEEL strings starting with `= `), not prose about what makes a
good process. Constraining the output format is what prevents invalid diagrams, not
asking nicely.

## Validate before you trust it

A generated diagram should be linted before it's treated as done — checking for
unreachable elements, empty gateway conditions, and (for Camunda 8 deployment)
Zeebe-parity issues that would fail at deploy time but not at parse time. Treat model
output as a draft, not a guarantee.

## Where to go next

- [AI integration guide](/docs/guides/ai) — the full compact-format reference
- [AI-generated BPMN workflows](/use-cases/ai-workflow-generation)
- [Generate BPMN 2.0 diagrams programmatically](/blog/generate-bpmn-diagrams-programmatically-typescript)
