# Stability and Versioning — What this page is for

A version number is a promise about breakage. This page says exactly which promise BPMN Kit
makes, so you can decide what to write in your `package.json` and know what an upgrade can
do to you.

Every package follows [Semantic Versioning 2.0.0](https://semver.org). The rest of this page
is the part semver leaves open: what counts as *the API* in a toolkit that also emits XML
files, writes state to disk and speaks HTTP.


## What is covered today

The promises below take effect for a given package **when it reaches 1.0.0**. Twelve packages
do — they are listed at the end of this page. A package still on 0.x is **not** covered by
them, even though other packages in the workspace are: under semver, 0.x makes no
compatibility promise at all. Releases of those have been additive in practice, but *in
practice* is not a contract, so pin an exact version if one of them matters to you.

---
Source: https://bpmnkit.com/docs/getting-started/stability
