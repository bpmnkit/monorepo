# Security Policy

## Reporting a vulnerability

**Please do not open a public issue or pull request for a security problem.**

Report it privately through GitHub's
[security advisory form](https://github.com/bpmnkit/monorepo/security/advisories/new). That
opens a channel only the maintainers can see, and it is the fastest way to reach us.

Useful things to include, as far as you have them: which package and version, what an attacker
can do, and the smallest reproduction you can manage. A diagram, template or expression that
triggers it is worth more than a description of it.

You will get an acknowledgement within **five working days**. If you do not, assume the report
did not arrive and open a plain issue saying only that you are waiting on a security response —
no details.

## Supported versions

Fixes land on the **latest minor of the current major** of the affected package. When a new
major ships, the previous major receives security fixes for **six months**; anything older
requires an upgrade.

Packages version independently, so "the current major" is per package. Twelve packages are at
1.0 or above and carry that window; the rest are on 0.x, where only the latest release is
supported. See [Stability and Versioning](https://bpmnkit.com/docs/getting-started/stability).

## Scope

This repository is a toolkit: parsers, builders, a renderer, a CLI and a local development
proxy. The things most worth reporting are therefore:

- **Parser input handling.** `@bpmnkit/core` parses BPMN, DMN and Form files from wherever the
  caller got them. Anything that turns a malformed document into unbounded memory or CPU, or
  escapes the parse into the host, is in scope — XXE, entity expansion, prototype pollution
  through parsed keys.
- **Expression evaluation.** `@bpmnkit/feel` evaluates FEEL from process definitions. It is not
  a sandbox boundary by design, but it must not reach the host: filesystem, network, `process`,
  or prototypes.
- **Generated output.** A template, label or expression that escapes its context in generated
  XML, HTML or an ASCII rendering — or that injects an executable payload into a deployed
  process.
- **`@bpmnkit/proxy`.** It binds to localhost and holds cluster credentials. Anything that lets
  a web page or another local process read those credentials, reach a configured cluster, or
  execute code through the sandbox is in scope.
- **Credential handling.** Profile storage, token caching, and anything that writes a secret to
  a log, an error message, or a generated file.

Out of scope: vulnerabilities in Camunda itself (report those to Camunda), findings that
require an attacker who already has local filesystem or process access, and anything reachable
only by a developer deliberately running untrusted code they wrote.

## Disclosure

We will agree a disclosure date with you, publish an advisory naming the affected versions and
the fix, and credit you unless you would rather we did not.
