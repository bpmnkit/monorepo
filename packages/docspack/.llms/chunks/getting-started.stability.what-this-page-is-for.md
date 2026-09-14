# Stability and Versioning — What this page is for

A version number is a promise about breakage. This page says exactly which promise BPMN Kit
makes, so you can decide what to write in your `package.json` and know what an upgrade can
do to you.

Every package follows [Semantic Versioning 2.0.0](https://semver.org). The rest of this page
is the part semver leaves open: what counts as *the API* in a toolkit that also emits XML
files, writes state to disk and speaks HTTP.


## Where things stand today

Every package is still on **0.x**, and under semver 0.x makes no compatibility promise at
all. In practice releases have been additive, but *in practice* is not a contract — pin an
exact version if that matters to you today.

The promises below take effect for a given package **when it reaches 1.0.0**. A package still
on 0.x is not covered by them, even after other packages in the workspace reach 1.0.

---
Source: https://bpmnkit.com/docs/getting-started/stability
